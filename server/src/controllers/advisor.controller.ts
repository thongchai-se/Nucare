import {
  AlertPriority,
  AlertStatus,
  AlertType,
  ConsultationPreferredChannel,
  ConsultationRequestStatus,
  Prisma,
  ReferralTarget,
  Role,
  RiskLevel,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { canAccessStudent, getStudentScopeWhere, isAdvisorRole } from "../lib/access-control";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import { getAcceptedReferralOwners } from "../lib/referral-ownership";
import { getLatestActiveSurveyResultsForStudents } from "../lib/survey-results";
import {
  formatStudentIdForResponse,
  getUserInitials,
  inferStudyYear,
  normalizeRiskLevel,
} from "../lib/user-format";

const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const ADVISOR_STUDENT_LIST_MAX_RESULTS = 1000;

const studentParamSchema = z.object({
  studentUserId: z.string().trim().min(1),
});

const createCareRecordSchema = z.object({
  careDate: z.string().trim().min(1),
  careType: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(4000),
  action: z.string().trim().min(1).max(4000),
  outcome: z.string().trim().max(4000).optional(),
});

const createReferralSchema = z.object({
  target: z.nativeEnum(ReferralTarget),
  reason: z.string().trim().min(1).max(4000),
  isUrgent: z.boolean().optional(),
});

const consultationRequestParamSchema = z.object({
  requestId: z.string().trim().min(1),
});

const updateConsultationRequestStatusSchema = z.object({
  status: z.enum([
    ConsultationRequestStatus.ACCEPTED,
    ConsultationRequestStatus.SCHEDULED,
    ConsultationRequestStatus.CLOSED,
  ]),
  scheduledAt: z.string().trim().optional(),
  advisorNote: z.string().trim().max(1200).optional(),
});

const consultationPreferredChannelLabels: Record<ConsultationPreferredChannel, string> = {
  IN_PERSON: "พบที่คณะ/ห้องพักอาจารย์",
  ONLINE: "ออนไลน์",
  PHONE: "โทรศัพท์",
  MESSAGE: "ข้อความในระบบ",
};

const normalizeSearch = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const parseCareDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseOptionalDateTime = (value: string | undefined): Date | null | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapReferralTargetLabel = (target: ReferralTarget): string =>
  target === ReferralTarget.COUNSELING_CENTER
    ? "ศูนย์ให้คำปรึกษา / ทีมจิตแพทย์"
    : "ฝ่ายพัฒนานักศึกษา";

type AdvisorConsultationRequestRecord = {
  id: string;
  topic: string;
  preferredChannel: ConsultationPreferredChannel;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: Date | null;
  acceptedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  alertId: string | null;
  student: {
    id: string;
    name: string;
    studentId: string | null;
    studyYear: number | null;
  };
};

const mapAdvisorConsultationRequest = (request: AdvisorConsultationRequestRecord) => ({
  id: request.id,
  studentId: request.student.id,
  studentName: request.student.name,
  studentCode: formatStudentIdForResponse(request.student.studentId),
  year: inferStudyYear(request.student.studentId, request.student.studyYear),
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
});

const resolveStudent = async (studentUserId: string) =>
  prisma.user.findFirst({
    where: {
      id: studentUserId,
      role: Role.STUDENT,
    },
    select: {
      id: true,
      studentId: true,
      studyYear: true,
      name: true,
      isActive: true,
      studentAssessments: {
        orderBy: { assessedAt: "desc" },
        take: 1,
        select: {
          riskLevel: true,
          assessedAt: true,
          totalScore: true,
          instrument: true,
        },
      },
      _count: {
        select: {
          studentCareRecords: true,
          studentBehaviorRecords: true,
        },
      },
    },
  });

const mapHistoryEntry = (
  item:
    | {
        id: string;
        kind: "CARE";
        date: Date;
        type: string;
        topic: string;
        action: string;
        outcome: string | null;
        actorName: string;
        isUrgent: boolean;
      }
    | {
        id: string;
        kind: "REFERRAL";
        date: Date;
        type: string;
        topic: string;
        action: string;
        outcome: string | null;
        actorName: string;
        isUrgent: boolean;
      }
    | {
        id: string;
        kind: "BEHAVIOR";
        date: Date;
        type: string;
        topic: string;
        action: string;
        outcome: string | null;
        actorName: string;
        isUrgent: boolean;
      }
    | {
        id: string;
        kind: "CONSULTATION";
        date: Date;
        type: string;
        topic: string;
        action: string;
        outcome: string | null;
        actorName: string;
        isUrgent: boolean;
      }
    | {
        id: string;
        kind: "SPECIALIZED_CARE";
        date: Date;
        type: string;
        topic: string;
        action: string;
        outcome: string | null;
        actorName: string;
        isUrgent: boolean;
      }
) => item;

export const listAdvisorStudents = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!userId || !isAdvisorRole(roles)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedQuery = listStudentsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({
      message: "Invalid query",
      errors: parsedQuery.error.flatten(),
    });
    return;
  }

  const search = normalizeSearch(parsedQuery.data.search);

  try {
    const where = await getStudentScopeWhere(Role.ADVISOR, userId);
    const students = await prisma.user.findMany({
      where: {
        ...where,
        ...(search
          ? {
              OR: [
                {
                  studentId: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        studentId: true,
        studyYear: true,
        name: true,
        studentAssessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
          select: {
            riskLevel: true,
            assessedAt: true,
            totalScore: true,
            instrument: true,
          },
        },
        _count: {
          select: {
            studentCareRecords: true,
            studentBehaviorRecords: true,
          },
        },
      },
      orderBy: [
        {
          studentId: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: ADVISOR_STUDENT_LIST_MAX_RESULTS,
    });
    const latestSurveyByStudentId = await getLatestActiveSurveyResultsForStudents(
      students.map((student) => student.id)
    );

    res.status(200).json({
      students: students.map((student) => {
        const latestSurvey = latestSurveyByStudentId.get(student.id);
        const latestAssessment = student.studentAssessments[0] ?? null;

        return {
          id: student.id,
          studentId: formatStudentIdForResponse(student.studentId),
          name: student.name,
          image: getUserInitials(student.name, "นศ"),
          year: inferStudyYear(student.studentId, student.studyYear),
          riskLevel: normalizeRiskLevel(latestSurvey?.riskLevel ?? latestAssessment?.riskLevel ?? RiskLevel.NORMAL),
          lastAssessment: latestSurvey?.assessedAt ?? latestAssessment?.assessedAt ?? null,
          careRecordCount: student._count.studentCareRecords,
          behaviorRecordCount: student._count.studentBehaviorRecords,
          latestScore: latestSurvey?.totalScore ?? latestAssessment?.totalScore ?? null,
          latestInstrument: latestSurvey?.instrument ?? latestAssessment?.instrument ?? null,
        };
      }),
      total: students.length,
    });
  } catch (error) {
    console.error("List advisor students error:", error);
    res.status(500).json({ message: "Failed to list students" });
  }
};

export const listAdvisorReferrals = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!userId || !isAdvisorRole(roles)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const referrals = await prisma.caseReferral.findMany({
      where: {
        advisorId: userId,
      },
      select: {
        id: true,
        target: true,
        reason: true,
        isUrgent: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            studyYear: true,
          },
        },
        specializedCareRecords: {
          orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            sessionDate: true,
            mentalHealthUser: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            specializedCareRecords: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      take: 200,
    });

    const acceptedOwnerByReferralId = await getAcceptedReferralOwners(referrals.map((referral) => referral.id));

    res.status(200).json({
      referrals: referrals.map((referral) => {
        const latestCareRecord = referral.specializedCareRecords[0] ?? null;
        const acceptedOwner = acceptedOwnerByReferralId.get(referral.id) ?? null;

        return {
          id: referral.id,
          studentId: referral.student.id,
          studentName: referral.student.name,
          studentCode: formatStudentIdForResponse(referral.student.studentId),
          year: inferStudyYear(referral.student.studentId, referral.student.studyYear),
          target: referral.target,
          reason: referral.reason,
          isUrgent: referral.isUrgent,
          status: referral.status,
          createdAt: referral.createdAt,
          updatedAt: referral.updatedAt,
          currentOwnerName: latestCareRecord?.mentalHealthUser.name ?? acceptedOwner?.actorName ?? null,
          currentOwnerAssignedAt: acceptedOwner?.createdAt ?? null,
          careSessionCount: referral._count.specializedCareRecords,
          latestCareSessionAt: latestCareRecord?.sessionDate ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("List advisor referrals error:", error);
    res.status(500).json({ message: "Failed to list referrals" });
  }
};

export const listAdvisorConsultationRequests = async (req: Request, res: Response): Promise<void> => {
  const advisorId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!advisorId || !isAdvisorRole(roles)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const requests = await prisma.consultationRequest.findMany({
      where: {
        teacherId: advisorId,
      },
      orderBy: [
        {
          status: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
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
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            studyYear: true,
          },
        },
      },
    });

    res.status(200).json({
      requests: requests.map(mapAdvisorConsultationRequest),
    });
  } catch (error) {
    console.error("List advisor consultation requests error:", error);
    res.status(500).json({ message: "Failed to list consultation requests" });
  }
};

export const updateAdvisorConsultationRequest = async (req: Request, res: Response): Promise<void> => {
  const advisorId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!advisorId || !isAdvisorRole(roles)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = consultationRequestParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid consultation request id" });
    return;
  }

  const parsedBody = updateConsultationRequestStatusSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  const scheduledAt = parseOptionalDateTime(parsedBody.data.scheduledAt);
  if (scheduledAt === null) {
    res.status(400).json({ message: "รูปแบบวันเวลานัดหมายไม่ถูกต้อง" });
    return;
  }

  if (parsedBody.data.status === ConsultationRequestStatus.SCHEDULED && !scheduledAt) {
    res.status(400).json({ message: "กรุณาระบุวันเวลานัดหมาย" });
    return;
  }

  try {
    const existingRequest = await prisma.consultationRequest.findFirst({
      where: {
        id: parsedParams.data.requestId,
        teacherId: advisorId,
      },
      select: {
        id: true,
        alertId: true,
      },
    });

    if (!existingRequest) {
      res.status(404).json({ message: "ไม่พบคำขอปรึกษา" });
      return;
    }

    const now = new Date();
    const nextStatus = parsedBody.data.status;
    const advisorNote = parsedBody.data.advisorNote?.trim();

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.consultationRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          status: nextStatus,
          advisorNote: advisorNote || null,
          scheduledAt: nextStatus === ConsultationRequestStatus.SCHEDULED ? scheduledAt : undefined,
          acceptedAt:
            nextStatus === ConsultationRequestStatus.ACCEPTED ||
            nextStatus === ConsultationRequestStatus.SCHEDULED
              ? now
              : undefined,
          closedAt: nextStatus === ConsultationRequestStatus.CLOSED ? now : null,
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
          student: {
            select: {
              id: true,
              name: true,
              studentId: true,
              studyYear: true,
            },
          },
        },
      });

      if (existingRequest.alertId) {
        await tx.alert.updateMany({
          where: {
            id: existingRequest.alertId,
            recipientUserId: advisorId,
          },
          data: {
            status:
              nextStatus === ConsultationRequestStatus.CLOSED
                ? AlertStatus.CLOSED
                : AlertStatus.ACKNOWLEDGED,
          },
        });
      }

      return request;
    });

    await writeAuditLog({
      actorUserId: advisorId,
      action: "advisor.consultation-request.update",
      entityType: "ConsultationRequest",
      entityId: updatedRequest.id,
      description: `อาจารย์อัปเดตคำขอปรึกษาเป็น ${nextStatus}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "อัปเดตคำขอปรึกษาสำเร็จ",
      request: mapAdvisorConsultationRequest(updatedRequest),
    });
  } catch (error) {
    console.error("Update advisor consultation request error:", error);
    res.status(500).json({ message: "Failed to update consultation request" });
  }
};

export const getStudentHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!userId || !isAdvisorRole(roles)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = studentParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid student id",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  try {
    const canView = await canAccessStudent(Role.ADVISOR, userId, parsedParams.data.studentUserId);
    if (!canView) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const student = await resolveStudent(parsedParams.data.studentUserId);
    if (!student) {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    const [careRecords, referrals, behaviorRecords, specializedCareRecords, consultationRequests] = await Promise.all([
      prisma.careRecord.findMany({
        where: {
          studentId: student.id,
        },
        select: {
          id: true,
          careDate: true,
          careType: true,
          topic: true,
          action: true,
          outcome: true,
          advisor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          careDate: "desc",
        },
        take: 100,
      }),
      prisma.caseReferral.findMany({
        where: {
          studentId: student.id,
        },
        select: {
          id: true,
          target: true,
          reason: true,
          isUrgent: true,
          status: true,
          createdAt: true,
          advisor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      }),
      prisma.behaviorRecord.findMany({
        where: {
          studentId: student.id,
        },
        select: {
          id: true,
          observedAt: true,
          category: true,
          details: true,
          severity: true,
          instructor: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          observedAt: "desc",
        },
        take: 100,
      }),
      prisma.specializedCareRecord.findMany({
        where: {
          studentId: student.id,
        },
        select: {
          id: true,
          sessionDate: true,
          summary: true,
          interventionPlan: true,
          referralId: true,
          mentalHealthUser: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          sessionDate: "desc",
        },
        take: 100,
      }),
      prisma.consultationRequest.findMany({
        where: {
          studentId: student.id,
          teacherId: userId,
        },
        select: {
          id: true,
          topic: true,
          preferredChannel: true,
          note: true,
          status: true,
          advisorNote: true,
          scheduledAt: true,
          createdAt: true,
          teacher: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      }),
    ]);

    const acceptedOwnerByReferralId = await getAcceptedReferralOwners(referrals.map((referral) => referral.id));
    const latestSpecializedCareByReferralId = new Map<
      string,
      {
        sessionDate: Date;
        providerName: string;
      }
    >();

    specializedCareRecords.forEach((record) => {
      if (!record.referralId || latestSpecializedCareByReferralId.has(record.referralId)) {
        return;
      }

      latestSpecializedCareByReferralId.set(record.referralId, {
        sessionDate: record.sessionDate,
        providerName: record.mentalHealthUser.name,
      });
    });

    const history = [
      ...careRecords.map((record) =>
        mapHistoryEntry({
          id: record.id,
          kind: "CARE",
          date: record.careDate,
          type: record.careType,
          topic: record.topic,
          action: record.action,
          outcome: record.outcome,
          actorName: record.advisor.name,
          isUrgent: false,
        })
      ),
      ...referrals.map((record) =>
        mapHistoryEntry({
          id: record.id,
          kind: "REFERRAL",
          date: record.createdAt,
          type: "ส่งต่อเคส",
          topic: `ส่งต่อไปยัง ${mapReferralTargetLabel(record.target)}`,
          action: record.reason,
          outcome: `สถานะ: ${record.status}`,
          actorName: record.advisor.name,
          isUrgent: record.isUrgent,
        })
      ),
      ...behaviorRecords.map((record) =>
        mapHistoryEntry({
          id: record.id,
          kind: "BEHAVIOR",
          date: record.observedAt,
          type: "พฤติกรรมผิดปกติ",
          topic: record.category,
          action: record.details,
          outcome: `ระดับความรุนแรง: ${record.severity}`,
          actorName: record.instructor.name,
          isUrgent: record.severity === "HIGH",
        })
      ),
      ...consultationRequests.map((record) =>
        mapHistoryEntry({
          id: record.id,
          kind: "CONSULTATION",
          date: record.createdAt,
          type: "คำขอปรึกษา",
          topic: record.topic,
          action: [
            `ช่องทางที่สะดวก: ${consultationPreferredChannelLabels[record.preferredChannel]}`,
            record.note ? `รายละเอียด: ${record.note}` : null,
          ].filter(Boolean).join("\n"),
          outcome: [
            `สถานะ: ${record.status}`,
            record.scheduledAt ? `นัดหมาย: ${record.scheduledAt.toISOString()}` : null,
            record.advisorNote ? `หมายเหตุ: ${record.advisorNote}` : null,
          ].filter(Boolean).join("\n"),
          actorName: record.teacher.name,
          isUrgent: false,
        })
      ),
    ].sort((left, right) => right.date.getTime() - left.date.getTime());

    const latestSurveyByStudentId = await getLatestActiveSurveyResultsForStudents([student.id]);
    const latestSurvey = latestSurveyByStudentId.get(student.id);
    const latestAssessment = student.studentAssessments[0] ?? null;

    await writeAuditLog({
      actorUserId: userId,
      action: "advisor.student-history.view",
      entityType: "User",
      entityId: student.id,
      description: "อาจารย์ที่ปรึกษาเปิดดูประวัตินักศึกษาในความดูแล",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      student: {
        id: student.id,
        studentId: formatStudentIdForResponse(student.studentId),
        name: student.name,
        image: getUserInitials(student.name, "นศ"),
        year: inferStudyYear(student.studentId, student.studyYear),
        riskLevel: normalizeRiskLevel(latestSurvey?.riskLevel ?? latestAssessment?.riskLevel ?? RiskLevel.NORMAL),
        lastAssessment: latestSurvey?.assessedAt ?? latestAssessment?.assessedAt ?? null,
        careRecordCount: student._count.studentCareRecords,
        behaviorRecordCount: student._count.studentBehaviorRecords,
        latestScore: latestSurvey?.totalScore ?? latestAssessment?.totalScore ?? null,
        latestInstrument: latestSurvey?.instrument ?? latestAssessment?.instrument ?? null,
      },
      history,
    });
  } catch (error) {
    console.error("Get student history error:", error);
    res.status(500).json({ message: "Failed to fetch student history" });
  }
};

export const createCareRecord = async (req: Request, res: Response): Promise<void> => {
  const advisorId = req.user?.userId;
  const advisorRoles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!advisorId || !isAdvisorRole(advisorRoles)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = studentParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid student id",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  const parsedBody = createCareRecordSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  const parsedDate = parseCareDate(parsedBody.data.careDate);
  if (!parsedDate) {
    res.status(400).json({ message: "รูปแบบวันที่ไม่ถูกต้อง" });
    return;
  }

  try {
    const canView = await canAccessStudent(Role.ADVISOR, advisorId, parsedParams.data.studentUserId);
    if (!canView) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const student = await resolveStudent(parsedParams.data.studentUserId);
    if (!student) {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    const record = await prisma.careRecord.create({
      data: {
        studentId: student.id,
        advisorId,
        careDate: parsedDate,
        careType: parsedBody.data.careType.trim(),
        topic: parsedBody.data.topic.trim(),
        action: parsedBody.data.action.trim(),
        outcome: parsedBody.data.outcome?.trim() || null,
      },
      select: {
        id: true,
        careDate: true,
        careType: true,
        topic: true,
        action: true,
        outcome: true,
      },
    });

    res.status(201).json({
      message: "บันทึกข้อมูลการดูแลสำเร็จ",
      record,
      advisorRole: "ADVISOR",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Create care record prisma error:", error.code, error.message);
    } else {
      console.error("Create care record error:", error);
    }

    res.status(500).json({ message: "Failed to create care record" });
  }
};

export const createReferral = async (req: Request, res: Response): Promise<void> => {
  const advisorId = req.user?.userId;
  const advisorRoles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!advisorId || !isAdvisorRole(advisorRoles)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = studentParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({
      message: "Invalid student id",
      errors: parsedParams.error.flatten(),
    });
    return;
  }

  const parsedBody = createReferralSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const canView = await canAccessStudent(Role.ADVISOR, advisorId, parsedParams.data.studentUserId);
    if (!canView) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const student = await resolveStudent(parsedParams.data.studentUserId);
    if (!student) {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    const referral = await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId,
        target: parsedBody.data.target,
        reason: parsedBody.data.reason.trim(),
        isUrgent: Boolean(parsedBody.data.isUrgent),
      },
      select: {
        id: true,
        target: true,
        reason: true,
        isUrgent: true,
        status: true,
        createdAt: true,
      },
    });

    const recipientRole =
      parsedBody.data.target === ReferralTarget.COUNSELING_CENTER
        ? Role.MENTAL_HEALTH
        : Role.STUDENT_DEVELOPMENT;

    const recipientUsers = await prisma.user.findMany({
      where: {
        role: recipientRole,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (recipientUsers.length > 0) {
      await prisma.alert.createMany({
        data: recipientUsers.map((user) => ({
          recipientUserId: user.id,
          actorUserId: advisorId,
          studentId: student.id,
          type: AlertType.REFERRAL_RECEIVED,
          priority: parsedBody.data.isUrgent ? AlertPriority.HIGH : AlertPriority.MEDIUM,
          title: "มีเคสส่งต่อใหม่",
          message: parsedBody.data.reason.trim(),
          sourceType: "CaseReferral",
          sourceId: referral.id,
        })),
      });
    }

    await writeAuditLog({
      actorUserId: advisorId,
      action: "advisor.referral.create",
      entityType: "CaseReferral",
      entityId: referral.id,
      description: "อาจารย์ที่ปรึกษาส่งต่อเคส",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งต่อเคสสำเร็จ",
      referral,
      advisorRole: "ADVISOR",
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("Create referral prisma error:", error.code, error.message);
    } else {
      console.error("Create referral error:", error);
    }

    res.status(500).json({ message: "Failed to create referral" });
  }
};
