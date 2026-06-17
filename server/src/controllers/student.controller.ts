import {
  AlertPriority,
  AlertType,
  AssessmentInstrument,
  ConsultationPreferredChannel,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { writeAuditLog, getRequestIpAddress } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import { buildUserHasRoleWhere } from "../lib/roles";
import {
  createScreeningAlerts,
  getRiskLevelForAssessment,
  shouldEscalateToAdvancedAssessment,
} from "../lib/screening";
import { formatStudentIdForResponse, getUserInitials } from "../lib/user-format";

const assessmentAnswerSchema = z.object({
  questionCode: z.string().trim().min(1).max(40),
  questionText: z.string().trim().min(1).max(500),
  answerValue: z.string().trim().min(1).max(200),
});

const submitAssessmentSchema = z.object({
  instrument: z.nativeEnum(AssessmentInstrument),
  answers: z.array(assessmentAnswerSchema).min(1).max(20),
});

const createSosSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
});

const consultationTopics = [
  "การเรียนและผลการเรียน",
  "การฝึกปฏิบัติ/ขึ้นวอร์ด",
  "สุขภาพใจและความเครียด",
  "ทุนการศึกษาและค่าใช้จ่าย",
  "ความสัมพันธ์และครอบครัว",
  "การปรับตัวในมหาวิทยาลัย",
  "อื่น ๆ",
] as const;

const consultationPreferredChannelLabels: Record<ConsultationPreferredChannel, string> = {
  IN_PERSON: "พบที่คณะ/ห้องพักอาจารย์",
  ONLINE: "ออนไลน์",
  PHONE: "โทรศัพท์",
  MESSAGE: "ข้อความในระบบ",
};

const listConsultationTeachersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const createConsultationRequestSchema = z.object({
  teacherId: z.string().trim().min(1),
  topic: z.enum(consultationTopics),
  preferredChannel: z.nativeEnum(ConsultationPreferredChannel).default(ConsultationPreferredChannel.IN_PERSON),
  note: z.string().trim().max(1200).optional(),
});

const consultationTeacherRoleWhere = buildUserHasRoleWhere(Role.ADVISOR);

type ConsultationTeacherRecord = {
  id: string;
  name: string;
  employeeId: string | null;
  role: Role;
  additionalRoles: Role[];
};

const hasConsultationTeacherRole = (
  teacher: Pick<ConsultationTeacherRecord, "role" | "additionalRoles">,
  role: Role
): boolean => teacher.role === role || teacher.additionalRoles.includes(role);

const mapConsultationTeacher = (
  teacher: ConsultationTeacherRecord,
  isAssignedAdvisor: boolean
) => ({
  id: teacher.id,
  name: teacher.name,
  employeeId: teacher.employeeId,
  initials: getUserInitials(teacher.name, "อจ"),
  roleLabels: [
    hasConsultationTeacherRole(teacher, Role.ADVISOR) ? "อาจารย์ที่ปรึกษา" : null,
    hasConsultationTeacherRole(teacher, Role.INSTRUCTOR) ? "อาจารย์ผู้สอน" : null,
  ].filter(Boolean),
  isAssignedAdvisor,
});

type StudentConsultationRequestRecord = {
  id: string;
  topic: string;
  preferredChannel: ConsultationPreferredChannel;
  note: string | null;
  status: string;
  advisorNote: string | null;
  scheduledAt: Date | null;
  acceptedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  alertId: string | null;
  teacher: ConsultationTeacherRecord;
};

const mapStudentConsultationRequest = (request: StudentConsultationRequestRecord) => ({
  id: request.id,
  topic: request.topic,
  preferredChannel: request.preferredChannel,
  preferredChannelLabel: consultationPreferredChannelLabels[request.preferredChannel],
  note: request.note,
  status: request.status,
  advisorNote: request.advisorNote,
  scheduledAt: request.scheduledAt,
  acceptedAt: request.acceptedAt,
  closedAt: request.closedAt,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt,
  alertId: request.alertId,
  teacher: mapConsultationTeacher(request.teacher, false),
});

const answerValueScoreMap = new Map<string, number>([
  ["0", 0],
  ["1", 1],
  ["2", 2],
  ["3", 3],
  ["ไม่", 0],
  ["ไม่เลย", 0],
  ["ไม่มี", 0],
  ["ไม่มีเลย", 0],
  ["no", 0],
  ["none", 0],
  ["never", 0],
  ["เป็นบางวัน", 1],
  ["บางวัน", 1],
  ["several days", 1],
  ["เป็นบ่อย", 2],
  ["บ่อย", 2],
  ["มากกว่าครึ่ง", 2],
  ["more than half the days", 2],
  ["เป็นประจำ", 3],
  ["เกือบทุกวัน", 3],
  ["nearly every day", 3],
]);

const normalizeAnswerValue = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const deriveAnswerScore = (answerValue: string): number | null => {
  const normalized = normalizeAnswerValue(answerValue);
  const numericValue = Number.parseInt(normalized, 10);

  if (/^\d+$/.test(normalized) && Number.isInteger(numericValue) && numericValue >= 0 && numericValue <= 3) {
    return numericValue;
  }

  return answerValueScoreMap.get(normalized) ?? null;
};

export const getStudentDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const [
      student,
      latestAssessments,
      alerts,
      emergencyCases,
      advisorAssignments,
      consultationRequests,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          studentId: true,
          email: true,
          studyYear: true,
          section: true,
        },
      }),
      prisma.studentAssessment.findMany({
        where: { studentId: userId },
        orderBy: { assessedAt: "desc" },
        take: 5,
        select: {
          id: true,
          instrument: true,
          totalScore: true,
          riskLevel: true,
          assessedAt: true,
        },
      }),
      prisma.alert.findMany({
        where: {
          recipientUserId: userId,
          status: "OPEN",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.emergencyCase.findMany({
        where: { studentId: userId },
        orderBy: { openedAt: "desc" },
        take: 5,
      }),
      prisma.studentAdvisorAssignment.findMany({
        where: {
          studentId: userId,
          isActive: true,
        },
        orderBy: {
          assignedAt: "desc",
        },
        take: 5,
        select: {
          advisor: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              role: true,
              additionalRoles: true,
            },
          },
        },
      }),
      prisma.consultationRequest.findMany({
        where: {
          studentId: userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          topic: true,
          preferredChannel: true,
          note: true,
          status: true,
          advisorNote: true,
          scheduledAt: true,
          acceptedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
          alertId: true,
          teacher: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              role: true,
              additionalRoles: true,
            },
          },
        },
      }),
    ]);

    res.status(200).json({
      student: student
        ? {
            ...student,
            studentId: formatStudentIdForResponse(student.studentId),
            studyYear: student.studyYear ?? null,
            section: student.section ?? null,
          }
        : null,
      latestAssessments,
      alerts,
      emergencyCases,
      careTeam: advisorAssignments.map((assignment) =>
        mapConsultationTeacher(assignment.advisor, true)
      ),
      consultationRequests: consultationRequests.map(mapStudentConsultationRequest),
      nextRecommendedInstruments: [
        AssessmentInstrument.Q2,
        AssessmentInstrument.ST5,
      ],
    });
  } catch (error) {
    console.error("Get student dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch student dashboard" });
  }
};

export const submitAssessment = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = submitAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const scoredAnswers = parsed.data.answers.map((answer) => {
    const score = deriveAnswerScore(answer.answerValue);

    if (score === null) {
      return null;
    }

    return {
      ...answer,
      score,
    };
  });

  if (scoredAnswers.some((answer) => answer === null)) {
    res.status(400).json({ message: "Invalid assessment answer value" });
    return;
  }

  const trustedAnswers = scoredAnswers as Array<z.infer<typeof assessmentAnswerSchema> & { score: number }>;

  try {
    const totalScore = trustedAnswers.reduce((sum, answer) => sum + answer.score, 0);
    const riskLevel = getRiskLevelForAssessment(parsed.data.instrument, totalScore);

    const assessment = await prisma.studentAssessment.create({
      data: {
        studentId: userId,
        instrument: parsed.data.instrument,
        totalScore,
        riskLevel,
        assessedAt: new Date(),
        answers: {
          create: trustedAnswers.map((answer) => ({
            questionCode: answer.questionCode,
            questionText: answer.questionText,
            answerValue: answer.answerValue,
            score: answer.score,
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    await createScreeningAlerts(userId, totalScore, parsed.data.instrument);
    await writeAuditLog({
      actorUserId: userId,
      action: "student.assessment.submit",
      entityType: "StudentAssessment",
      entityId: assessment.id,
      description: `นักศึกษาส่งแบบประเมิน ${parsed.data.instrument} คะแนนรวม ${totalScore}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "บันทึกแบบประเมินสำเร็จ",
      assessment,
      nextStep: shouldEscalateToAdvancedAssessment(parsed.data.instrument, totalScore)
        ? {
            requiresAdvancedAssessment: true,
            recommendedInstruments: [AssessmentInstrument.Q9, AssessmentInstrument.Q8],
          }
        : {
            requiresAdvancedAssessment: false,
            recommendedInstruments: [],
          },
    });
  } catch (error) {
    console.error("Submit assessment error:", error);
    res.status(500).json({ message: "Failed to submit assessment" });
  }
};

export const listConsultationTeachers = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedQuery = listConsultationTeachersQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const search = parsedQuery.data.search?.trim();

  try {
    const teachers = await prisma.user.findMany({
      where: {
        AND: [
          {
            isActive: true,
          },
          consultationTeacherRoleWhere,
          search
            ? {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    employeeId: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              }
            : {},
        ],
      },
      orderBy: {
        name: "asc",
      },
      take: 20,
      select: {
        id: true,
        name: true,
        employeeId: true,
        role: true,
        additionalRoles: true,
        advisorAssignments: {
          where: {
            studentId: userId,
            isActive: true,
          },
          take: 1,
          select: {
            id: true,
          },
        },
      },
    });

    const mappedTeachers = teachers
      .map((teacher) => mapConsultationTeacher(teacher, teacher.advisorAssignments.length > 0))
      .sort((left, right) => {
        if (left.isAssignedAdvisor !== right.isAssignedAdvisor) {
          return left.isAssignedAdvisor ? -1 : 1;
        }

        return left.name.localeCompare(right.name, "th");
      });

    res.status(200).json({
      teachers: mappedTeachers,
      topics: consultationTopics,
      preferredChannels: consultationPreferredChannelLabels,
    });
  } catch (error) {
    console.error("List consultation teachers error:", error);
    res.status(500).json({ message: "Failed to list consultation teachers" });
  }
};

export const listConsultationRequests = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const requests = await prisma.consultationRequest.findMany({
      where: {
        studentId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        topic: true,
        preferredChannel: true,
        note: true,
        status: true,
        advisorNote: true,
        scheduledAt: true,
        acceptedAt: true,
        closedAt: true,
        createdAt: true,
        updatedAt: true,
        alertId: true,
        teacher: {
          select: {
            id: true,
            name: true,
            employeeId: true,
            role: true,
            additionalRoles: true,
          },
        },
      },
    });

    res.status(200).json({
      requests: requests.map(mapStudentConsultationRequest),
    });
  } catch (error) {
    console.error("List consultation requests error:", error);
    res.status(500).json({ message: "Failed to list consultation requests" });
  }
};

export const createConsultationRequest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createConsultationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const [student, teacher] = await Promise.all([
      prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
          name: true,
          studentId: true,
        },
      }),
      prisma.user.findFirst({
        where: {
          id: parsed.data.teacherId,
          isActive: true,
          ...consultationTeacherRoleWhere,
        },
        select: {
          id: true,
          name: true,
          employeeId: true,
          role: true,
          additionalRoles: true,
        },
      }),
    ]);

    if (!student) {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    if (!teacher) {
      res.status(404).json({ message: "ไม่พบอาจารย์ที่เลือก หรือบัญชีอาจารย์ไม่พร้อมใช้งาน" });
      return;
    }

    const note = parsed.data.note?.trim();
    const preferredChannelLabel = consultationPreferredChannelLabels[parsed.data.preferredChannel];
    const message = [
      `นักศึกษา: ${student.name}${student.studentId ? ` (${formatStudentIdForResponse(student.studentId)})` : ""}`,
      `ประเด็นที่ต้องการปรึกษา: ${parsed.data.topic}`,
      `ช่องทางที่สะดวก: ${preferredChannelLabel}`,
      note ? `รายละเอียดเพิ่มเติม: ${note}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const consultationRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.consultationRequest.create({
        data: {
          studentId: userId,
          teacherId: teacher.id,
          topic: parsed.data.topic,
          preferredChannel: parsed.data.preferredChannel,
          note: note || null,
        },
        select: {
          id: true,
        },
      });

      const alert = await tx.alert.create({
        data: {
          recipientUserId: teacher.id,
          actorUserId: userId,
          studentId: userId,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: "นักศึกษาขอรับคำปรึกษา",
          message,
          sourceType: "ConsultationRequest",
          sourceId: request.id,
        },
        select: {
          id: true,
        },
      });

      return tx.consultationRequest.update({
        where: {
          id: request.id,
        },
        data: {
          alertId: alert.id,
        },
        select: {
          id: true,
          topic: true,
          preferredChannel: true,
          note: true,
          status: true,
          advisorNote: true,
          scheduledAt: true,
          acceptedAt: true,
          closedAt: true,
          createdAt: true,
          updatedAt: true,
          alertId: true,
          teacher: {
            select: {
              id: true,
              name: true,
              employeeId: true,
              role: true,
              additionalRoles: true,
            },
          },
        },
      });
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "student.consultation-request.create",
      entityType: "ConsultationRequest",
      entityId: consultationRequest.id,
      description: `นักศึกษาขอรับคำปรึกษากับ ${teacher.name} เรื่อง ${parsed.data.topic}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งคำขอรับคำปรึกษาสำเร็จ",
      request: mapStudentConsultationRequest(consultationRequest),
    });
  } catch (error) {
    console.error("Create consultation request error:", error);
    res.status(500).json({ message: "Failed to create consultation request" });
  }
};

export const createSosCase = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createSosSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const emergencyCase = await prisma.emergencyCase.create({
      data: {
        studentId: userId,
        reportedByUserId: userId,
        summary: parsed.data.summary,
      },
    });

    const mentalHealthUsers = await prisma.user.findMany({
      where: {
        ...buildUserHasRoleWhere(Role.MENTAL_HEALTH),
        isActive: true,
      },
      select: { id: true },
    });

    if (mentalHealthUsers.length > 0) {
      await prisma.alert.createMany({
        data: mentalHealthUsers.map((user) => ({
          recipientUserId: user.id,
          actorUserId: userId,
          studentId: userId,
          type: "SOS_OPENED",
          priority: "CRITICAL",
          title: "มีการกดปุ่ม SOS",
          message: parsed.data.summary,
          sourceType: "EmergencyCase",
          sourceId: emergencyCase.id,
        })),
      });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "student.sos.create",
      entityType: "EmergencyCase",
      entityId: emergencyCase.id,
      description: "นักศึกษากดปุ่ม SOS",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งสัญญาณฉุกเฉินสำเร็จ",
      emergencyCase,
    });
  } catch (error) {
    console.error("Create SOS case error:", error);
    res.status(500).json({ message: "Failed to create SOS case" });
  }
};
