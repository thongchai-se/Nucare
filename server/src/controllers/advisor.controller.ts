import {
  AlertPriority,
  AlertStatus,
  AlertType,
  BehaviorSeverity,
  ConsultationOfferStatus,
  ConsultationPreferredChannel,
  ConsultationRequestStatus,
  Prisma,
  ReferralStatus,
  ReferralTarget,
  Role,
  RiskLevel,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { canAccessStudent, getStudentScopeWhere, isAdvisorRole } from "../lib/access-control";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import {
  assertObservationReportTarget,
  createStudentObservation,
  listReporterObservations,
  searchStudentsForObservation,
} from "../lib/behavior-observation";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import {
  ACTIVE_REFERRAL_STATUSES,
  activeReferralConflictMessage,
  isActiveReferralStatus,
} from "../lib/active-referral";
import { buildReferralRoadmap } from "../lib/referral-roadmap";
import { getAcceptedReferralOwners } from "../lib/referral-ownership";
import {
  canAdvisorCloseCompletedConsultation,
  canAdvisorConfirmCancelConsultation,
  canAdvisorDirectCancelConsultation,
  consultationChannelLabel,
} from "../lib/consultation-channels";
import {
  CANCELLED_CASE_LABEL,
  consultationClosedStatusLabel,
  formatAdvisorConfirmCancelNote,
  formatAdvisorDirectCancelNote,
  isAdvisorCancelReason,
  validateAdvisorCancelReasonInput,
} from "../lib/consultation-close";
import {
  formatBehaviorHistoryOutcome,
  formatConsultationHistoryAction,
  formatConsultationHistoryOutcome,
  formatReferralHistoryOutcome,
  stripSeedMarkers,
} from "../lib/history-display";
import {
  mapConsultationScheduleOffer,
  pickLatestPendingOffer,
} from "../lib/consultation-schedule-offers";
import { getLatestActiveSurveyResultsForStudents } from "../lib/survey-results";
import {
  hasCrisisWellnessSignal,
  loadWellnessSignalsByStudentId,
} from "../lib/student-wellness-summary";
import { buildUserHasRoleWhere } from "../lib/roles";
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
  /** ต้องมีบริบทพอให้ผู้เชี่ยวชาญอ่านก่อนนัดนิสิต — ไม่บังคับว่าต้องเป็นเคสวิกฤต */
  reason: z.string().trim().min(20).max(4000),
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
    ConsultationRequestStatus.CANCELLED,
  ]),
  scheduledAt: z.string().trim().optional(),
  advisorNote: z.string().trim().max(1200).optional(),
  /** เหตุผลยกเลิกเมื่ออาจารย์ยกเลิกเองจาก PENDING/ACCEPTED */
  cancelReason: z.string().trim().max(200).optional(),
  cancelDetail: z.string().trim().max(500).optional(),
});


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

type AdvisorConsultationOfferRecord = {
  id: string;
  proposedAt: Date;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: Date;
  proposedById: string;
  proposedBy: { id: string; name: string };
};

type AdvisorConsultationRequestRecord = {
  id: string;
  topic: string;
  preferredChannel: ConsultationPreferredChannel;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: Date | null;
  scheduleLocation: string | null;
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
  teacherId?: string;
  scheduleOffers?: AdvisorConsultationOfferRecord[];
};

const mapAdvisorConsultationRequest = (request: AdvisorConsultationRequestRecord) => {
  const teacherId = request.teacherId ?? "";
  const offers = (request.scheduleOffers ?? []).map((offer) =>
    mapConsultationScheduleOffer(offer, request.student.id, teacherId)
  );
  const latestPendingOffer = pickLatestPendingOffer(offers);

  return {
    id: request.id,
    studentId: request.student.id,
    studentName: request.student.name,
    studentCode: formatStudentIdForResponse(request.student.studentId),
    year: inferStudyYear(request.student.studentId, request.student.studyYear),
    topic: request.topic,
    preferredChannel: request.preferredChannel,
    preferredChannelLabel: consultationChannelLabel(request.preferredChannel),
    note: request.note,
    status: request.status,
    advisorNote: request.advisorNote,
    scheduledAt: request.scheduledAt,
    scheduleLocation: request.scheduleLocation,
    acceptedAt: request.acceptedAt,
    closedAt: request.closedAt,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    alertId: request.alertId,
    latestPendingOffer,
    scheduleOffers: offers,
  };
};

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
    const studentIds = students.map((student) => student.id);
    const [latestSurveyByStudentId, wellnessByStudentId] = await Promise.all([
      getLatestActiveSurveyResultsForStudents(studentIds),
      loadWellnessSignalsByStudentId(prisma, studentIds),
    ]);

    res.status(200).json({
      students: students.map((student) => {
        const latestSurvey = latestSurveyByStudentId.get(student.id);
        const latestAssessment = student.studentAssessments[0] ?? null;
        const wellnessSignals = wellnessByStudentId.get(student.id) ?? [];

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
          wellnessSignals,
          hasCrisisWellnessSignal: hasCrisisWellnessSignal(wellnessSignals),
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
        advisor: {
          select: {
            name: true,
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
        const currentOwnerName = latestCareRecord?.mentalHealthUser.name ?? acceptedOwner?.actorName ?? null;

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
          currentOwnerName,
          currentOwnerAssignedAt: acceptedOwner?.createdAt ?? null,
          careSessionCount: referral._count.specializedCareRecords,
          latestCareSessionAt: latestCareRecord?.sessionDate ?? null,
          roadmap: buildReferralRoadmap({
            createdAt: referral.createdAt,
            status: referral.status,
            advisorName: referral.advisor.name,
            targetLabel: mapReferralTargetLabel(referral.target),
            reason: referral.reason,
            isUrgent: referral.isUrgent,
            acceptedAt: acceptedOwner?.createdAt ?? (referral.status === "PENDING" ? null : referral.updatedAt),
            acceptedByName: currentOwnerName,
            closedAt: referral.status === "CLOSED" ? referral.updatedAt : null,
            careSessionCount: referral._count.specializedCareRecords,
            latestCareSessionAt: latestCareRecord?.sessionDate ?? null,
            latestCareProviderName: latestCareRecord?.mentalHealthUser.name ?? null,
          }),
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
        teacherId: true,
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
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            studyYear: true,
          },
        },
        scheduleOffers: {
          orderBy: { createdAt: "desc" },
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

  if (parsedBody.data.status === ConsultationRequestStatus.SCHEDULED) {
    res.status(400).json({
      message: "กรุณาใช้ปุ่มเสนอนัดแล้วให้นิสิตยอมรับ — ไม่สามารถตั้งนัดตรงได้",
      code: "USE_SCHEDULE_OFFER",
    });
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
        status: true,
        advisorNote: true,
      },
    });

    if (!existingRequest) {
      res.status(404).json({ message: "ไม่พบคำขอปรึกษา" });
      return;
    }

    const now = new Date();
    const nextStatus = parsedBody.data.status;
    const rawAdvisorNote = parsedBody.data.advisorNote?.trim();

    let cancelAdvisorNote: string | null = null;
    if (nextStatus === ConsultationRequestStatus.CANCELLED) {
      const confirmingStudentCancel = canAdvisorConfirmCancelConsultation(existingRequest.status);
      const directCancel = canAdvisorDirectCancelConsultation(existingRequest.status);
      if (!confirmingStudentCancel && !directCancel) {
        res.status(400).json({
          message: "ยกเลิกได้เมื่อคิวยังไม่ยืนยันนัด หรือเมื่อนิสิตขอยกเลิกแล้วเท่านั้น",
          code: "CANCEL_NOT_ALLOWED",
        });
        return;
      }

      if (directCancel) {
        const reasonError = validateAdvisorCancelReasonInput(
          parsedBody.data.cancelReason,
          parsedBody.data.cancelDetail
        );
        if (reasonError) {
          res.status(400).json({ message: reasonError, code: "CANCEL_REASON_REQUIRED" });
          return;
        }
        // validate ผ่านแล้ว — reason เป็นค่าในรายการ
        const reason = parsedBody.data.cancelReason!.trim();
        if (!isAdvisorCancelReason(reason)) {
          res.status(400).json({ message: "เหตุผลไม่ถูกต้อง", code: "CANCEL_REASON_INVALID" });
          return;
        }
        cancelAdvisorNote = formatAdvisorDirectCancelNote(reason, parsedBody.data.cancelDetail);
      } else {
        cancelAdvisorNote = formatAdvisorConfirmCancelNote(
          existingRequest.advisorNote,
          rawAdvisorNote
        );
      }
    }

    if (nextStatus === ConsultationRequestStatus.CLOSED) {
      if (!canAdvisorCloseCompletedConsultation(existingRequest.status)) {
        res.status(400).json({
          message: "ปิดเคสหลังคุยได้เมื่อมีนัดยืนยันแล้ว — หากจะเลิกคิวก่อนนัดให้ใช้ปุ่มยกเลิก",
          code: "CLOSE_NOT_ALLOWED",
        });
        return;
      }
    }

    const advisorNote =
      nextStatus === ConsultationRequestStatus.CANCELLED
        ? cancelAdvisorNote
        : rawAdvisorNote || null;

    const updatedRequest = await prisma.$transaction(async (tx) => {
      if (nextStatus === ConsultationRequestStatus.CANCELLED) {
        await tx.consultationScheduleOffer.updateMany({
          where: {
            requestId: existingRequest.id,
            status: ConsultationOfferStatus.PENDING,
          },
          data: { status: ConsultationOfferStatus.CANCELLED },
        });
      }

      const request = await tx.consultationRequest.update({
        where: {
          id: existingRequest.id,
        },
        data: {
          status: nextStatus,
          advisorNote,
          scheduledAt:
            nextStatus === ConsultationRequestStatus.CANCELLED
              ? null
              : nextStatus === ConsultationRequestStatus.SCHEDULED
                ? scheduledAt
                : undefined,
          scheduleLocation:
            nextStatus === ConsultationRequestStatus.CANCELLED ? null : undefined,
          acceptedAt:
            nextStatus === ConsultationRequestStatus.ACCEPTED ||
            nextStatus === ConsultationRequestStatus.SCHEDULED
              ? now
              : undefined,
          closedAt:
            nextStatus === ConsultationRequestStatus.CLOSED ||
            nextStatus === ConsultationRequestStatus.CANCELLED
              ? now
              : null,
        },
        select: {
          id: true,
          teacherId: true,
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
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              studentId: true,
              studyYear: true,
            },
          },
          scheduleOffers: {
            orderBy: { createdAt: "desc" },
            take: 20,
            select: {
              id: true,
              proposedAt: true,
              location: true,
              note: true,
              status: true,
              createdAt: true,
              proposedById: true,
              proposedBy: { select: { id: true, name: true } },
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
              nextStatus === ConsultationRequestStatus.CLOSED ||
              nextStatus === ConsultationRequestStatus.CANCELLED
                ? AlertStatus.CLOSED
                : AlertStatus.ACKNOWLEDGED,
          },
        });
      }

      return request;
    });

    if (
      nextStatus === ConsultationRequestStatus.SCHEDULED ||
      nextStatus === ConsultationRequestStatus.ACCEPTED ||
      nextStatus === ConsultationRequestStatus.CLOSED ||
      nextStatus === ConsultationRequestStatus.CANCELLED
    ) {
      const statusLabel =
        nextStatus === ConsultationRequestStatus.SCHEDULED
          ? "นัดหมายแล้ว"
          : nextStatus === ConsultationRequestStatus.ACCEPTED
            ? "รับคำขอแล้ว"
            : nextStatus === ConsultationRequestStatus.CANCELLED
              ? CANCELLED_CASE_LABEL
              : consultationClosedStatusLabel(updatedRequest.status, updatedRequest.advisorNote);
      const whenLabel = updatedRequest.scheduledAt
        ? updatedRequest.scheduledAt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })
        : null;
      const detail = whenLabel ? `${statusLabel} · ${whenLabel}` : statusLabel;
      await notifyUser({
        recipientUserId: updatedRequest.student.id,
        recipientEmail: updatedRequest.student.email,
        channels: { inApp: true, email: Boolean(updatedRequest.student.email) },
        alert: {
          actorUserId: advisorId,
          studentId: updatedRequest.student.id,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: `อัปเดตคำขอปรึกษา: ${statusLabel}`,
          message: `${updatedRequest.topic} — ${detail}`,
          sourceType: "ConsultationRequest",
          sourceId: updatedRequest.id,
        },
        email: {
          subject: `NuCare: คำขอปรึกษา${statusLabel}`,
          text: `เรียน ${updatedRequest.student.name}\n\nคำขอปรึกษาเรื่อง "${updatedRequest.topic}" ${statusLabel}${whenLabel ? `\nวันเวลานัด: ${whenLabel}` : ""}\n\nเข้าสู่ระบบ NuCare เพื่อดูรายละเอียด`,
        },
      });
    }

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
        take: 20,
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
        take: 20,
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
        take: 20,
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
        take: 20,
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
        take: 20,
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
          topic: stripSeedMarkers(record.topic) || record.topic,
          action: stripSeedMarkers(record.action) || record.action,
          outcome: record.outcome ? stripSeedMarkers(record.outcome) || null : null,
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
          action: stripSeedMarkers(record.reason) || record.reason,
          outcome: formatReferralHistoryOutcome(record.status),
          actorName: record.advisor.name,
          isUrgent: record.isUrgent,
        })
      ),
      ...behaviorRecords.map((record) =>
        mapHistoryEntry({
          id: record.id,
          kind: "BEHAVIOR",
          date: record.observedAt,
          type: "ข้อสังเกตจากผู้สอน",
          topic: record.category,
          action: stripSeedMarkers(record.details) || record.details,
          outcome: formatBehaviorHistoryOutcome(record.severity),
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
          action: formatConsultationHistoryAction({
            channelLabel: consultationChannelLabel(record.preferredChannel),
            note: record.note,
            scheduleLocation: record.scheduleLocation,
          }),
          outcome: formatConsultationHistoryOutcome({
            status: record.status,
            scheduledAt: record.scheduledAt,
            advisorNote: record.advisorNote,
          }),
          actorName: record.teacher.name,
          isUrgent: false,
        })
      ),
    ]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .slice(0, 20);

    const [latestSurveyByStudentId, wellnessByStudentId] = await Promise.all([
      getLatestActiveSurveyResultsForStudents([student.id]),
      loadWellnessSignalsByStudentId(prisma, [student.id]),
    ]);
    const latestSurvey = latestSurveyByStudentId.get(student.id);
    const latestAssessment = student.studentAssessments[0] ?? null;
    const wellnessSignals = wellnessByStudentId.get(student.id) ?? [];

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
        wellnessSignals,
        hasCrisisWellnessSignal: hasCrisisWellnessSignal(wellnessSignals),
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

    const reason = parsedBody.data.reason.trim();
    const isUrgent = Boolean(parsedBody.data.isUrgent);

    let referral: {
      id: string;
      target: ReferralTarget;
      reason: string;
      isUrgent: boolean;
      status: ReferralStatus;
      createdAt: Date;
    };

    try {
      referral = await prisma.$transaction(
        async (tx) => {
          // บล็อกซ้ำเฉพาะ target เดียวกัน — สวัสดิการกับศูนย์ให้คำปรึกษาเปิดพร้อมกันได้
          const openReferral = await tx.caseReferral.findFirst({
            where: {
              studentId: student.id,
              target: parsedBody.data.target,
              status: { in: ACTIVE_REFERRAL_STATUSES },
            },
            select: {
              id: true,
              status: true,
              target: true,
            },
            orderBy: { createdAt: "desc" },
          });

          if (openReferral && isActiveReferralStatus(openReferral.status)) {
            const error = new Error(
              activeReferralConflictMessage(openReferral.status, openReferral.target)
            );
            (error as Error & { code?: string }).code = "ACTIVE_REFERRAL";
            throw error;
          }

          return tx.caseReferral.create({
            data: {
              studentId: student.id,
              advisorId,
              target: parsedBody.data.target,
              reason,
              isUrgent,
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (
        error instanceof Error &&
        ((error as Error & { code?: string }).code === "ACTIVE_REFERRAL" ||
          /มีเคสที่กำลังดูแล|มีเคสส่งต่อที่รอรับ/.test(error.message))
      ) {
        res.status(409).json({ message: error.message });
        return;
      }
      throw error;
    }

    const recipientRole =
      parsedBody.data.target === ReferralTarget.COUNSELING_CENTER
        ? Role.MENTAL_HEALTH
        : Role.STUDENT_DEVELOPMENT;

    const recipientUsers = await prisma.user.findMany({
      where: {
        AND: [buildUserHasRoleWhere(recipientRole), { isActive: true }],
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
          priority: isUrgent ? AlertPriority.HIGH : AlertPriority.MEDIUM,
          title: "มีเคสส่งต่อใหม่",
          message: reason,
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

const createObservationSchema = z.object({
  studentId: z.string().trim().min(1),
  observedAt: z.string().trim().min(1),
  category: z.string().trim().min(1).max(120),
  details: z.string().trim().min(1).max(4000),
  severity: z.nativeEnum(BehaviorSeverity),
});

/** ค้นหานิสิตสำหรับแจ้งข้อสังเกต — ไม่รวมนิสิตในสังกัดผู้แจ้ง */
export const searchObservationStudents = async (req: Request, res: Response): Promise<void> => {
  const advisorId = req.user?.userId;
  if (!advisorId || !isAdvisorRole(req.user?.roles ?? req.user?.role)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = listStudentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid query", errors: parsed.error.flatten() });
    return;
  }

  try {
    const students = await searchStudentsForObservation(parsed.data.search, advisorId);
    res.status(200).json({ students });
  } catch (error) {
    console.error("Search observation students error:", error);
    res.status(500).json({ message: "Failed to search students" });
  }
};

/** ประวัติข้อสังเกตที่ที่ปรึกษาคนนี้เป็นผู้แจ้ง */
export const listObservationRecords = async (req: Request, res: Response): Promise<void> => {
  const advisorId = req.user?.userId;
  if (!advisorId || !isAdvisorRole(req.user?.roles ?? req.user?.role)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const records = await listReporterObservations(advisorId);
    res.status(200).json({ records });
  } catch (error) {
    console.error("List observation records error:", error);
    res.status(500).json({ message: "Failed to list observation records" });
  }
};

/** แจ้งข้อสังเกตนิสิตของอาจารย์ท่านอื่น — สัญญาณเข้าที่ปรึกษาของนิสิตคนนั้น */
export const createObservationRecord = async (req: Request, res: Response): Promise<void> => {
  const advisorId = req.user?.userId;
  if (!advisorId || !isAdvisorRole(req.user?.roles ?? req.user?.role)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createObservationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const target = await assertObservationReportTarget(advisorId, parsed.data.studentId);
    if (!target.ok) {
      res.status(target.status).json({ message: target.message, code: target.code });
      return;
    }

    const observedAt = new Date(parsed.data.observedAt);
    if (Number.isNaN(observedAt.getTime())) {
      res.status(400).json({ message: "รูปแบบวันที่ไม่ถูกต้อง" });
      return;
    }

    const { behaviorRecord, notifiedAdvisorCount } = await createStudentObservation({
      reporterUserId: advisorId,
      studentId: parsed.data.studentId,
      observedAt,
      category: parsed.data.category,
      details: parsed.data.details,
      severity: parsed.data.severity,
    });

    await writeAuditLog({
      actorUserId: advisorId,
      action: "advisor.observation.create",
      entityType: "BehaviorRecord",
      entityId: behaviorRecord.id,
      description: "อาจารย์แจ้งข้อสังเกตแนวโน้มไปยังที่ปรึกษาของนิสิต (นอกสังกัดผู้แจ้ง)",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message:
        notifiedAdvisorCount > 0
          ? "บันทึกข้อสังเกตแล้ว — ส่งสัญญาณถึงที่ปรึกษาของนิสิตแล้ว"
          : "บันทึกข้อสังเกตแล้ว แต่ยังไม่พบที่ปรึกษาที่รับผิดชอบนิสิตคนนี้",
      behaviorRecord,
      notifiedAdvisorCount,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "OWN_ADVISEE_NOT_ALLOWED") {
      res.status(400).json({
        message:
          "ไม่สามารถแจ้งข้อสังเกตนิสิตในสังกัดตัวเองได้ — ใช้เมนูนี้สำหรับแจ้งนิสิตของอาจารย์ท่านอื่น",
        code: "OWN_ADVISEE_NOT_ALLOWED",
      });
      return;
    }
    console.error("Create observation record error:", error);
    res.status(500).json({ message: "Failed to create observation record" });
  }
};
