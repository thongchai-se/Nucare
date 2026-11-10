import {
  AlertPriority,
  AlertType,
  AssessmentInstrument,
  ConsultationOfferStatus,
  ConsultationPreferredChannel,
  ConsultationRequestStatus,
  MentalHealthAppointmentStatus,
  ReferralStatus,
  ReferralTarget,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import {
  ACTIVE_CONSULTATION_STATUSES,
  activeConsultationConflictMessage,
} from "../lib/active-consultation";
import { writeAuditLog, getRequestIpAddress } from "../lib/audit-log";
import {
  canStudentCancelConsultation,
  consultationChannelLabel,
  isStudentRequestChannel,
  studentRequestChannelOptions,
} from "../lib/consultation-channels";
import {
  formatStudentCancelRequestNote,
  isStudentCancelReason,
} from "../lib/consultation-close";
import {
  mapConsultationScheduleOffer,
  pickLatestPendingOffer,
} from "../lib/consultation-schedule-offers";
import { mergeConsultationTeacherLists } from "../lib/consultation-teachers";
import { buildStudentCounselingRequestEmail } from "../lib/email/messages";
import { serializeMentalHealthAppointment } from "../lib/mental-health-appointments";
import {
  createSosOpenedAlerts,
  listSosAlertRecipients,
} from "../lib/notify-sos-recipients";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import { buildUserHasRoleWhere, hasAssignedRole } from "../lib/roles";
import {
  createScreeningAlerts,
  getRiskLevelForAssessment,
  shouldEscalateToAdvancedAssessment,
} from "../lib/screening";
import {
  ACTIVE_REFERRAL_STATUSES,
  planStudentCounselingRequest,
} from "../lib/student-counseling-request";
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

const createSosSchema = z
  .object({
    summary: z.string().trim().min(1).max(4000),
  })
  .strict();

const createCounselingRequestSchema = z
  .object({
    note: z.string().trim().max(2000).optional(),
  })
  .strict();

const consultationTopics = [
  "การเรียนและผลการเรียน",
  "การฝึกปฏิบัติ/ขึ้นวอร์ด",
  "สุขภาพใจและความเครียด",
  "ทุนการศึกษาและค่าใช้จ่าย",
  "ความสัมพันธ์และครอบครัว",
  "การปรับตัวในมหาวิทยาลัย",
  "อื่น ๆ",
] as const;

const listConsultationTeachersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const createConsultationRequestSchema = z.object({
  teacherId: z.string().trim().min(1),
  topic: z.enum(consultationTopics),
  preferredChannel: z
    .string()
    .trim()
    .refine(isStudentRequestChannel, { message: "เลือกได้เฉพาะออนไลน์หรือพบตัว" })
    .default(ConsultationPreferredChannel.IN_PERSON),
  note: z.string().trim().max(1200).optional(),
});

const consultationRequestParamSchema = z.object({
  requestId: z.string().trim().min(1),
});

const consultationTeacherRoleWhere = buildUserHasRoleWhere(Role.ADVISOR);

type ConsultationTeacherRecord = {
  id: string;
  name: string;
  employeeId: string | null;
  image: string | null;
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
  image: teacher.image,
  initials: getUserInitials(teacher.name, "อจ"),
  roleLabels: [
    hasConsultationTeacherRole(teacher, Role.ADVISOR) ? "อาจารย์ที่ปรึกษา" : null,
    hasConsultationTeacherRole(teacher, Role.INSTRUCTOR) ? "อาจารย์ผู้สอน" : null,
  ].filter(Boolean),
  isAssignedAdvisor,
});

type StudentConsultationOfferRecord = {
  id: string;
  proposedAt: Date;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: Date;
  proposedById: string;
  proposedBy: { id: string; name: string };
};

type StudentConsultationRequestRecord = {
  id: string;
  studentId?: string;
  topic: string;
  preferredChannel: ConsultationPreferredChannel;
  note: string | null;
  status: string;
  advisorNote: string | null;
  scheduledAt: Date | null;
  scheduleLocation?: string | null;
  acceptedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  alertId: string | null;
  teacher: ConsultationTeacherRecord;
  scheduleOffers?: StudentConsultationOfferRecord[];
};

const consultationOfferSelect = {
  orderBy: { createdAt: "desc" as const },
  take: 20,
  select: {
    id: true,
    proposedAt: true,
    location: true,
    note: true,
    status: true,
    createdAt: true,
    proposedById: true,
    proposedBy: {
      select: {
        id: true,
        name: true,
      },
    },
  },
};

/** แปลงคำขอปรึกษาของนิสิต พร้อมข้อเสนอนัดที่รอตอบ */
const mapStudentConsultationRequest = (request: StudentConsultationRequestRecord) => {
  const studentId = request.studentId ?? "";
  const offers = (request.scheduleOffers ?? []).map((offer) =>
    mapConsultationScheduleOffer(offer, studentId, request.teacher.id)
  );
  const latestPendingOffer = pickLatestPendingOffer(offers);

  return {
    id: request.id,
    topic: request.topic,
    preferredChannel: request.preferredChannel,
    preferredChannelLabel: consultationChannelLabel(request.preferredChannel),
    note: request.note,
    status: request.status,
    advisorNote: request.advisorNote,
    scheduledAt: request.scheduledAt,
    scheduleLocation: request.scheduleLocation ?? null,
    acceptedAt: request.acceptedAt,
    closedAt: request.closedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    alertId: request.alertId,
    teacher: mapConsultationTeacher(request.teacher, false),
    latestPendingOffer,
    scheduleOffers: offers,
  };
};

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
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
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
      mentalHealthAppointments,
      openCounselingReferral,
      hasAssignedAdvisor,
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
              image: true,
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
          studentId: true,
          topic: true,
          preferredChannel: true,
          note: true,
          status: true,
          advisorNote: true,
          scheduledAt: true,
          scheduleLocation: true,
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
              image: true,
              role: true,
              additionalRoles: true,
            },
          },
          scheduleOffers: consultationOfferSelect,
        },
      }),
      prisma.mentalHealthAppointment.findMany({
        where: {
          studentId: userId,
          status: MentalHealthAppointmentStatus.SCHEDULED,
          scheduledAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
        orderBy: {
          scheduledAt: "asc",
        },
        take: 10,
        include: {
          student: {
            select: {
              name: true,
            },
          },
          mentalHealthUser: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.caseReferral.findFirst({
        where: {
          studentId: userId,
          target: ReferralTarget.COUNSELING_CENTER,
          status: { in: ACTIVE_REFERRAL_STATUSES },
        },
        select: { id: true, status: true, reason: true, createdAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.studentAdvisorAssignment.findFirst({
        where: { studentId: userId, isActive: true },
        select: { id: true },
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
      mentalHealthAppointments: mentalHealthAppointments.map((appointment) => {
        const serialized = serializeMentalHealthAppointment(appointment);
        return {
          id: serialized.id,
          kind: "MENTAL_HEALTH" as const,
          scheduledAt: serialized.scheduledAt,
          location: serialized.location,
          note: serialized.note,
          providerName: serialized.providerName,
        };
      }),
      openCounselingReferral: openCounselingReferral
        ? {
            id: openCounselingReferral.id,
            status: openCounselingReferral.status,
            reason: openCounselingReferral.reason,
            createdAt: openCounselingReferral.createdAt,
          }
        : null,
      canRequestExpertCounseling: Boolean(hasAssignedAdvisor) && !openCounselingReferral,
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
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
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
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
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
    const searchFilter = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { employeeId: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const teacherSelect = {
      id: true,
      name: true,
      employeeId: true,
      image: true,
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
    } as const;

    // ดึงที่ปรึกษาที่ผูกกับนิสิตก่อน — ห้ามถูกตัดด้วย take ก่อนเรียงลำดับ
    const assignedTeachers = await prisma.user.findMany({
      where: {
        AND: [
          { isActive: true },
          consultationTeacherRoleWhere,
          {
            advisorAssignments: {
              some: {
                studentId: userId,
                isActive: true,
              },
            },
          },
          searchFilter,
        ],
      },
      orderBy: { name: "asc" },
      select: teacherSelect,
    });

    const assignedIds = assignedTeachers.map((teacher) => teacher.id);
    const remainingSlots = Math.max(20 - assignedTeachers.length, 0);
    const otherTeachers =
      remainingSlots === 0
        ? []
        : await prisma.user.findMany({
            where: {
              AND: [
                { isActive: true },
                consultationTeacherRoleWhere,
                assignedIds.length > 0 ? { id: { notIn: assignedIds } } : {},
                searchFilter,
              ],
            },
            orderBy: { name: "asc" },
            take: Math.max(remainingSlots, 20),
            select: teacherSelect,
          });

    const teachers = mergeConsultationTeacherLists(assignedTeachers, otherTeachers, 20);

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
      preferredChannels: studentRequestChannelOptions(),
    });
  } catch (error) {
    console.error("List consultation teachers error:", error);
    res.status(500).json({ message: "Failed to list consultation teachers" });
  }
};

export const listConsultationRequests = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
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
        studentId: true,
        topic: true,
        preferredChannel: true,
        note: true,
        status: true,
        advisorNote: true,
        scheduledAt: true,
        scheduleLocation: true,
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
            image: true,
            role: true,
            additionalRoles: true,
          },
        },
        scheduleOffers: consultationOfferSelect,
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
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
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
    const [student, teacher, openRequest] = await Promise.all([
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
          image: true,
          role: true,
          additionalRoles: true,
        },
      }),
      prisma.consultationRequest.findFirst({
        where: {
          studentId: userId,
          status: { in: ACTIVE_CONSULTATION_STATUSES },
        },
        select: {
          id: true,
          status: true,
        },
        orderBy: {
          updatedAt: "desc",
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

    if (openRequest) {
      res.status(409).json({
        message: activeConsultationConflictMessage(openRequest.status),
        code: "ACTIVE_CONSULTATION",
        openRequestId: openRequest.id,
        openStatus: openRequest.status,
      });
      return;
    }

    const note = parsed.data.note?.trim();
    const preferredChannelLabel = consultationChannelLabel(
      parsed.data.preferredChannel as ConsultationPreferredChannel
    );
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
          studentId: true,
          topic: true,
          preferredChannel: true,
          note: true,
          status: true,
          advisorNote: true,
          scheduledAt: true,
          scheduleLocation: true,
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
              image: true,
              role: true,
              additionalRoles: true,
            },
          },
          scheduleOffers: consultationOfferSelect,
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

const cancelConsultationBodySchema = z
  .object({
    reason: z.string().trim().min(1).max(200),
  })
  .strict();

/** นิสิตขอยกเลิกก่อนยืนยันนัด — ส่งให้อาจารย์ยืนยัน แล้วจึงเป็นสถานะยกเลิก */
export const cancelConsultationRequest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = consultationRequestParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid consultation request id" });
    return;
  }

  const parsedBody = cancelConsultationBodySchema.safeParse(req.body ?? {});
  if (!parsedBody.success) {
    res.status(400).json({ message: "กรุณาเลือกเหตุผลในการยกเลิก", code: "CANCEL_REASON_REQUIRED" });
    return;
  }

  if (!isStudentCancelReason(parsedBody.data.reason)) {
    res.status(400).json({ message: "เหตุผลไม่ถูกต้อง", code: "CANCEL_REASON_INVALID" });
    return;
  }

  const cancelNote = formatStudentCancelRequestNote(parsedBody.data.reason);

  try {
    const existing = await prisma.consultationRequest.findFirst({
      where: {
        id: parsedParams.data.requestId,
        studentId: userId,
      },
      select: {
        id: true,
        status: true,
        teacherId: true,
        topic: true,
        alertId: true,
        teacher: { select: { id: true, name: true, email: true } },
        student: { select: { id: true, name: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ message: "ไม่พบคำขอปรึกษา" });
      return;
    }

    if (!canStudentCancelConsultation(existing.status)) {
      res.status(400).json({
        message:
          existing.status === ConsultationRequestStatus.SCHEDULED
            ? "มีนัดที่ยืนยันแล้ว — หากต้องการเปลี่ยนวันให้ใช้ปุ่มขอเปลี่ยนนัด หรือติดต่ออาจารย์"
            : existing.status === ConsultationRequestStatus.CANCEL_REQUESTED
              ? "ส่งคำขอยกเลิกไปแล้ว รออาจารย์ยืนยัน"
              : "ไม่สามารถยกเลิกเคสนี้ได้",
        code: "CANCEL_NOT_ALLOWED",
      });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.consultationScheduleOffer.updateMany({
        where: {
          requestId: existing.id,
          status: ConsultationOfferStatus.PENDING,
        },
        data: { status: ConsultationOfferStatus.CANCELLED },
      });

      return tx.consultationRequest.update({
        where: { id: existing.id },
        data: {
          status: ConsultationRequestStatus.CANCEL_REQUESTED,
          scheduledAt: null,
          scheduleLocation: null,
          advisorNote: cancelNote,
        },
        select: {
          id: true,
          studentId: true,
          topic: true,
          preferredChannel: true,
          note: true,
          status: true,
          advisorNote: true,
          scheduledAt: true,
          scheduleLocation: true,
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
              image: true,
              role: true,
              additionalRoles: true,
            },
          },
          scheduleOffers: consultationOfferSelect,
        },
      });
    });

    await notifyUser({
      recipientUserId: existing.teacher.id,
      recipientEmail: existing.teacher.email,
      channels: { inApp: true, email: Boolean(existing.teacher.email) },
      alert: {
        actorUserId: userId,
        studentId: userId,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: `นิสิตขอยกเลิกคำขอปรึกษา`,
        message: `${existing.student.name} ขอยกเลิกเรื่อง "${existing.topic}" — ${parsedBody.data.reason}`,
        sourceType: "ConsultationRequest",
        sourceId: existing.id,
      },
      email: {
        subject: `NuCare: นิสิตขอยกเลิกคำขอปรึกษา`,
        text: `เรียน ${existing.teacher.name}\n\nนิสิต ${existing.student.name} ขอยกเลิกคำขอปรึกษาเรื่อง "${existing.topic}"\nเหตุผล: ${parsedBody.data.reason}\n\nกรุณาเข้าสู่ระบบ NuCare เพื่อกดยืนยันยกเลิก`,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "student.consultation-request.cancel-request",
      entityType: "ConsultationRequest",
      entityId: existing.id,
      description: `นักศึกษาขอยกเลิกเรื่อง ${existing.topic} (${parsedBody.data.reason})`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "ส่งคำขอยกเลิกแล้ว รออาจารย์ยืนยัน",
      request: mapStudentConsultationRequest(updated),
    });
  } catch (error) {
    console.error("Cancel consultation request error:", error);
    res.status(500).json({ message: "Failed to cancel consultation request" });
  }
};

/** นิสิตขอนัดผู้เชี่ยวชาญสุขภาพจิต — สร้างคิว COUNSELING_CENTER ให้ทีม MH รับงาน */
export const createStudentCounselingRequest = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createCounselingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const [student, assignment, activeCounseling] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, studentId: true },
      }),
      prisma.studentAdvisorAssignment.findFirst({
        where: { studentId: userId, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { advisorId: true },
      }),
      prisma.caseReferral.findFirst({
        where: {
          studentId: userId,
          target: ReferralTarget.COUNSELING_CENTER,
          status: { in: ACTIVE_REFERRAL_STATUSES },
        },
        select: { id: true, status: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    if (!student) {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    const plan = planStudentCounselingRequest({
      assignedAdvisorId: assignment?.advisorId ?? null,
      hasActiveCounselingReferral: Boolean(activeCounseling),
      activeStatus: activeCounseling?.status ?? null,
      note: parsed.data.note?.trim() || null,
    });

    if (plan.action === "reject") {
      const status = plan.reason === "active_counseling_referral" ? 409 : 400;
      res.status(status).json({
        message: plan.message,
        code: plan.reason.toUpperCase(),
        openReferralId: activeCounseling?.id,
      });
      return;
    }

    const referral = await prisma.caseReferral.create({
      data: {
        studentId: userId,
        advisorId: plan.advisorId,
        target: ReferralTarget.COUNSELING_CENTER,
        reason: plan.reason,
        isUrgent: plan.isUrgent,
        status: ReferralStatus.PENDING,
      },
      select: { id: true, reason: true, status: true, createdAt: true },
    });

    const mentalHealthUsers = await prisma.user.findMany({
      where: {
        ...buildUserHasRoleWhere(Role.MENTAL_HEALTH),
        isActive: true,
      },
      select: { id: true, email: true },
    });

    const emailCopy = buildStudentCounselingRequestEmail({
      studentName: student.name,
      studentIdLabel: formatStudentIdForResponse(student.studentId),
      note: parsed.data.note?.trim() || null,
    });

    for (const mhUser of mentalHealthUsers) {
      await notifyUser({
        recipientUserId: mhUser.id,
        recipientEmail: mhUser.email,
        channels: { inApp: true, email: true },
        alert: {
          actorUserId: userId,
          studentId: userId,
          type: AlertType.REFERRAL_RECEIVED,
          priority: AlertPriority.HIGH,
          title: "นิสิตขอนัดผู้เชี่ยวชาญสุขภาพจิต",
          message: plan.reason,
          sourceType: "CaseReferral",
          sourceId: referral.id,
        },
        email: emailCopy,
      });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "student.counseling-request.create",
      entityType: "CaseReferral",
      entityId: referral.id,
      description: "นักศึกษาขอนัดผู้เชี่ยวชาญสุขภาพจิต",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งคำขอพบผู้เชี่ยวชาญแล้ว ทีมสุขภาพจิตจะติดต่อนัดหมาย",
      referral,
      notifiedCount: mentalHealthUsers.length,
    });
  } catch (error) {
    console.error("Create student counseling request error:", error);
    res.status(500).json({ message: "Failed to create counseling request" });
  }
};

/** นิสิตกด SOS — บันทึกเคสและแจ้งทีมสุขภาพจิต + ที่ปรึกษาที่มอบหมาย */
export const createSosCase = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT)) {
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

    const recipients = await listSosAlertRecipients(userId);
    const notifiedCount = await createSosOpenedAlerts({
      studentId: userId,
      actorUserId: userId,
      emergencyCaseId: emergencyCase.id,
      summary: parsed.data.summary,
      recipients,
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "student.sos.create",
      entityType: "EmergencyCase",
      entityId: emergencyCase.id,
      description: `นักศึกษากดปุ่ม SOS และแจ้งทีมดูแล ${notifiedCount} คน`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ระบบได้รับคำขอช่วยเหลือแล้ว ทีมดูแลได้รับการแจ้งแล้ว หากฉุกเฉินให้โทร 1323",
      emergencyCase,
      notifiedCount,
    });
  } catch (error) {
    console.error("Create SOS case error:", error);
    res.status(500).json({ message: "Failed to create SOS case" });
  }
};
