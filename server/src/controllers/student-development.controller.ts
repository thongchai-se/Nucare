import {
  AlertPriority,
  AlertStatus,
  AlertType,
  Prisma,
  ReferralStatus,
  ReferralTarget,
  RiskLevel,
  Role,
  SurveyWaveStatus,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { formatAuditMetadata } from "../lib/audit-metadata";
import {
  canMutateAcceptedReferral,
  mentalHealthOwnershipDeniedMessage,
} from "../lib/mental-health-ownership";
import {
  canTransitionMentalHealthReferralStatus,
  mentalHealthReferralTransitionError,
} from "../lib/mental-health-referral-status";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import { hasAssignedRole } from "../lib/roles";
import { closeReferralReceivedAlerts } from "../lib/close-referral-alerts";
import { filterReferralAlertsForPortalTarget } from "../lib/referral-alert-portal-filter";
import {
  escapeHtmlForEmail,
  isStudentDevelopmentPendingAssessment,
} from "../lib/student-development-pending";
import { decideWelfareClaim } from "../lib/student-development-claim";
import { shouldRequireClosedReason } from "../lib/student-development-welfare-note";
import { formatStudentIdForResponse, inferStudyYear, normalizeRiskLevel } from "../lib/user-format";

const createReminderSchema = z
  .object({
    message: z.string().trim().min(1).max(4000),
    studentUserIds: z.array(z.string().trim().min(1)).max(500).optional(),
    sendInApp: z.boolean().optional().default(true),
    sendEmail: z.boolean().optional().default(false),
  })
  .strict();

const referralParamSchema = z
  .object({
    referralId: z.string().trim().min(1),
  })
  .strict();

const updateReferralStatusSchema = z
  .object({
    status: z.nativeEnum(ReferralStatus),
    staffNote: z.string().trim().max(4000).optional(),
    closedReason: z.string().trim().max(2000).optional(),
  })
  .strict();

const STUDENT_DEVELOPMENT_STUDENT_MAX_RESULTS = 2500;
const STUDENT_DEVELOPMENT_REMINDER_LOG_MAX_RESULTS = 5000;

const mapPendingStatus = (reminderAt: Date | null): string =>
  reminderAt ? "แจ้งเตือนแล้ว รอทำแบบประเมิน" : "ยังไม่พบผลประเมิน";

const normalizeScore = (riskLevel: RiskLevel | undefined): "normal" | "medium" | "high" => {
  return normalizeRiskLevel(riskLevel ?? RiskLevel.NORMAL);
};

/** เงื่อนไขนิสิตค้างประเมิน — มี OPEN assignment ที่ยังไม่ทำเท่านั้น */
const pendingStudentWhere: Prisma.UserWhereInput = {
  role: Role.STUDENT,
  isActive: true,
  surveyAssignments: {
    some: {
      completedAt: null,
      wave: { status: SurveyWaveStatus.OPEN },
    },
  },
};

/** นิสิตที่ประเมินแล้ว (ไม่ค้าง) — ใช้สรุปกลุ่มเสี่ยง */
const assessedStudentWhere: Prisma.UserWhereInput = {
  role: Role.STUDENT,
  isActive: true,
  surveyAssignments: {
    none: {
      completedAt: null,
      wave: { status: SurveyWaveStatus.OPEN },
    },
  },
  OR: [{ surveyResponses: { some: {} } }, { studentAssessments: { some: {} } }],
};

const pendingStudentSelect = {
  id: true,
  studentId: true,
  studyYear: true,
  section: true,
  name: true,
  email: true,
  createdAt: true,
  surveyAssignments: {
    where: {
      completedAt: null,
      wave: {
        status: SurveyWaveStatus.OPEN,
      },
    },
    take: 5,
    select: {
      id: true,
      waveId: true,
    },
  },
  surveyResponses: {
    orderBy: { submittedAt: "desc" as const },
    take: 1,
    select: {
      riskLevel: true,
    },
  },
  studentAssessments: {
    orderBy: [{ assessedAt: "desc" as const }, { createdAt: "desc" as const }],
    take: 1,
    select: {
      riskLevel: true,
    },
  },
  studentAssignments: {
    where: {
      isActive: true,
    },
    take: 1,
    select: {
      advisor: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

const assessedRiskSelect = {
  id: true,
  surveyResponses: {
    orderBy: { submittedAt: "desc" as const },
    take: 1,
    select: { riskLevel: true },
  },
  studentAssessments: {
    orderBy: [{ assessedAt: "desc" as const }, { createdAt: "desc" as const }],
    take: 1,
    select: { riskLevel: true },
  },
};

/** โหลดแดชบอร์ดพัฒนานิสิต — คัดกรองค้างประเมิน กลุ่มเสี่ยง และเคสสวัสดิการ */
export const getStudentDevelopmentDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT_DEVELOPMENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const [totalTarget, pendingCount, pendingRows, assessedRows, referrals, openWave, openAlerts] =
      await Promise.all([
        prisma.user.count({
          where: { role: Role.STUDENT, isActive: true },
        }),
        prisma.user.count({ where: pendingStudentWhere }),
        prisma.user.findMany({
          where: pendingStudentWhere,
          select: pendingStudentSelect,
          orderBy: [{ studyYear: "asc" }, { studentId: "asc" }, { createdAt: "asc" }],
          take: STUDENT_DEVELOPMENT_STUDENT_MAX_RESULTS,
        }),
        prisma.user.findMany({
          where: assessedStudentWhere,
          select: assessedRiskSelect,
          take: STUDENT_DEVELOPMENT_STUDENT_MAX_RESULTS,
        }),
        prisma.caseReferral.findMany({
          where: {
            target: ReferralTarget.STUDENT_DEVELOPMENT,
          },
          select: {
            id: true,
            reason: true,
            isUrgent: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            acceptedByUserId: true,
            staffNote: true,
            closedReason: true,
            acceptedBy: {
              select: { name: true },
            },
            advisor: {
              select: {
                name: true,
              },
            },
            student: {
              select: {
                id: true,
                studentId: true,
                studyYear: true,
                section: true,
                email: true,
                phone: true,
                guardianPhone: true,
                name: true,
                studentAssessments: {
                  orderBy: [{ assessedAt: "desc" }, { createdAt: "desc" }],
                  take: 1,
                  select: {
                    riskLevel: true,
                    totalScore: true,
                    instrument: true,
                    assessedAt: true,
                  },
                },
              },
            },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          take: 200,
        }),
        prisma.surveyWave.findFirst({
          where: { status: SurveyWaveStatus.OPEN },
          select: { id: true, label: true },
          orderBy: { opensAt: "desc" },
        }),
        prisma.alert.findMany({
          where: {
            recipientUserId: userId,
            status: AlertStatus.OPEN,
            type: AlertType.REFERRAL_RECEIVED,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            title: true,
            message: true,
            priority: true,
            createdAt: true,
            studentId: true,
            type: true,
            sourceType: true,
            sourceId: true,
          },
        }),
      ]);

    const portalAlerts = await filterReferralAlertsForPortalTarget(
      openAlerts,
      ReferralTarget.STUDENT_DEVELOPMENT
    );

    const pendingStudentIds = pendingRows
      .filter(isStudentDevelopmentPendingAssessment)
      .map((student) => student.id);

    const latestReminderLogs = pendingStudentIds.length
      ? await prisma.alert.findMany({
          where: {
            recipientUserId: {
              in: pendingStudentIds,
            },
            sourceType: "StudentDevelopmentReminder",
          },
          select: {
            recipientUserId: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: Math.min(pendingStudentIds.length * 3, STUDENT_DEVELOPMENT_REMINDER_LOG_MAX_RESULTS),
        })
      : [];

    const latestReminderByStudentId = new Map<string, Date>();
    latestReminderLogs.forEach((alert) => {
      if (!latestReminderByStudentId.has(alert.recipientUserId)) {
        latestReminderByStudentId.set(alert.recipientUserId, alert.createdAt);
      }
    });

    const riskOf = (student: (typeof assessedRows)[number]) =>
      student.surveyResponses[0]?.riskLevel ?? student.studentAssessments[0]?.riskLevel;
    const normalRiskCount = assessedRows.filter(
      (student) => normalizeScore(riskOf(student)) === "normal"
    ).length;
    const mediumRiskCount = assessedRows.filter(
      (student) => normalizeScore(riskOf(student)) === "medium"
    ).length;
    const highRiskCount = assessedRows.filter(
      (student) => normalizeScore(riskOf(student)) === "high"
    ).length;

    const pendingStudents = pendingRows
      .filter(isStudentDevelopmentPendingAssessment)
      .map((student) => {
        const latestReminderAt = latestReminderByStudentId.get(student.id) ?? null;
        const advisor = student.studentAssignments[0]?.advisor ?? null;

        return {
          id: student.id,
          studentCode: formatStudentIdForResponse(student.studentId),
          name: student.name,
          year: inferStudyYear(student.studentId, student.studyYear),
          section: student.section || "-",
          advisorName: advisor?.name ?? null,
          latestReminderAt,
          status: mapPendingStatus(latestReminderAt),
        };
      });

    const riskInsights = [
      {
        id: "normal",
        title: "กลุ่มปกติ",
        tone: "normal",
        count: normalRiskCount,
        description: "",
      },
      {
        id: "medium",
        title: "กลุ่มเสี่ยงปานกลาง",
        tone: "attention",
        count: mediumRiskCount,
        description: "",
      },
      {
        id: "high",
        title: "กลุ่มเสี่ยงสูง",
        tone: "critical",
        count: highRiskCount,
        description: "",
      },
    ];

    const supportCases = referrals
      .map((referral) => ({
        id: referral.id,
        status: referral.status,
        isUrgent: referral.isUrgent,
        reason: referral.reason,
        createdAt: referral.createdAt,
        updatedAt: referral.updatedAt,
        acceptedByUserId: referral.acceptedByUserId,
        acceptedByName: referral.acceptedBy?.name ?? null,
        staffNote: referral.staffNote,
        closedReason: referral.closedReason,
        advisorName: referral.advisor.name,
        student: {
          id: referral.student.id,
          name: referral.student.name,
          studentCode: formatStudentIdForResponse(referral.student.studentId),
          year: inferStudyYear(referral.student.studentId, referral.student.studyYear),
          section: referral.student.section || "-",
          email: referral.student.email,
          phone: referral.student.phone,
          guardianPhone: referral.student.guardianPhone,
          riskLevel: normalizeScore(referral.student.studentAssessments[0]?.riskLevel),
          latestAssessment: referral.student.studentAssessments[0] ?? null,
        },
      }))
      .sort((left, right) => {
        const statusRank: Record<ReferralStatus, number> = {
          PENDING: 0,
          ACCEPTED: 1,
          CLOSED: 2,
        };

        const urgentDiff = Number(right.isUrgent) - Number(left.isUrgent);
        if (urgentDiff !== 0) {
          return urgentDiff;
        }

        const statusDiff = statusRank[left.status] - statusRank[right.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });

    const completed = Math.max(0, totalTarget - pendingCount);
    const pending = pendingCount;
    const percentage = totalTarget === 0 ? 0 : Math.round((completed / totalTarget) * 100);

    res.status(200).json({
      screeningStats: {
        totalTarget,
        completed,
        pending,
        percentage,
        normalRiskCount,
        mediumRiskCount,
        highRiskCount,
      },
      screeningMeta: {
        hasOpenSurveyWave: Boolean(openWave),
        openWaveLabel: openWave?.label ?? null,
      },
      pendingStudents,
      riskInsights,
      supportCases,
      alerts: portalAlerts.map((alert) => ({
        id: alert.id,
        title: alert.title,
        message: alert.message,
        priority: alert.priority,
        createdAt: alert.createdAt,
        studentId: alert.studentId,
      })),
    });
  } catch (error) {
    console.error("Get student development dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch student development dashboard" });
  }
};

/** อัปเดตสถานะ referral พัฒนานิสิตตามลำดับคิว และแจ้งอาจารย์ที่ส่งต่อ */
export const updateStudentDevelopmentReferralStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT_DEVELOPMENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = referralParamSchema.safeParse(req.params);
  const parsedBody = updateReferralStatusSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  try {
    const existingReferral = await prisma.caseReferral.findFirst({
      where: {
        id: parsedParams.data.referralId,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
      },
      select: {
        id: true,
        status: true,
        reason: true,
        acceptedByUserId: true,
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
          },
        },
        advisor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!existingReferral) {
      res.status(404).json({ message: "Referral not found" });
      return;
    }

    const nextStatus = parsedBody.data.status;
    if (!canTransitionMentalHealthReferralStatus(existingReferral.status, nextStatus)) {
      res.status(400).json({
        message: mentalHealthReferralTransitionError(existingReferral.status, nextStatus),
      });
      return;
    }

    if (
      existingReferral.status === ReferralStatus.ACCEPTED &&
      nextStatus === ReferralStatus.CLOSED &&
      !canMutateAcceptedReferral(existingReferral.acceptedByUserId, userId)
    ) {
      res.status(403).json({ message: mentalHealthOwnershipDeniedMessage() });
      return;
    }

    if (nextStatus === ReferralStatus.ACCEPTED) {
      const otherAccepted = await prisma.caseReferral.findFirst({
        where: {
          studentId: existingReferral.student.id,
          target: ReferralTarget.STUDENT_DEVELOPMENT,
          status: ReferralStatus.ACCEPTED,
          id: { not: existingReferral.id },
        },
        select: { id: true },
      });
      if (otherAccepted) {
        res.status(409).json({
          message: "นิสิตคนนี้มีเคสสวัสดิการที่กำลังประสานงานอยู่แล้ว ไม่สามารถรับซ้ำได้",
        });
        return;
      }
    }

    const staffNote = parsedBody.data.staffNote?.trim() || undefined;
    const closedReason =
      nextStatus === ReferralStatus.CLOSED
        ? parsedBody.data.closedReason?.trim() || undefined
        : undefined;

    if (shouldRequireClosedReason(nextStatus, closedReason)) {
      res.status(400).json({ message: "กรุณาระบุเหตุผลสั้น ๆ เมื่อปิดเคสสวัสดิการ" });
      return;
    }

    const claimed = await prisma.caseReferral.updateMany({
      where: {
        id: existingReferral.id,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        status: existingReferral.status,
        // รับเคสได้เฉพาะคิวที่ยังไม่มีเจ้าของ — กัน race / แย่งรับ
        ...(nextStatus === ReferralStatus.ACCEPTED ? { acceptedByUserId: null } : {}),
      },
      data: {
        status: nextStatus,
        ...(nextStatus === ReferralStatus.ACCEPTED ? { acceptedByUserId: userId } : {}),
        ...(staffNote !== undefined ? { staffNote } : {}),
        ...(closedReason !== undefined ? { closedReason } : {}),
      },
    });

    if (claimed.count === 0) {
      const latest = await prisma.caseReferral.findUnique({
        where: { id: existingReferral.id },
        select: { status: true },
      });
      if (latest?.status === ReferralStatus.ACCEPTED && nextStatus === ReferralStatus.ACCEPTED) {
        res.status(409).json({ message: "เคสนี้มีผู้รับประสานแล้ว กรุณารีเฟรชรายการ" });
        return;
      }
      if (latest?.status === ReferralStatus.CLOSED) {
        res.status(409).json({ message: "เคสนี้ถูกปิดไปแล้ว กรุณารีเฟรชรายการ" });
        return;
      }
      res.status(409).json({ message: "สถานะเคสเปลี่ยนไปแล้ว กรุณารีเฟรชแล้วลองใหม่" });
      return;
    }

    const referral = await prisma.caseReferral.findUniqueOrThrow({
      where: { id: existingReferral.id },
      select: {
        id: true,
        status: true,
        acceptedByUserId: true,
        updatedAt: true,
      },
    });

    const studentLabel =
      formatStudentIdForResponse(existingReferral.student.studentId) || existingReferral.student.name;
    const statusLabel =
      nextStatus === ReferralStatus.ACCEPTED
        ? "งานพัฒนานิสิตรับเคสสวัสดิการแล้ว"
        : existingReferral.status === ReferralStatus.PENDING
          ? "งานพัฒนานิสิตปิด/ปฏิเสธคิวส่งต่อ"
          : "งานพัฒนานิสิตปิดเคสแล้ว";

    await notifyUser({
      recipientUserId: existingReferral.advisor.id,
      recipientEmail: existingReferral.advisor.email,
      channels: { inApp: true, email: Boolean(existingReferral.advisor.email) },
      alert: {
        actorUserId: userId,
        studentId: existingReferral.student.id,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: statusLabel,
        message: `${existingReferral.student.name} (${studentLabel}) · ${existingReferral.reason.slice(0, 180)}`,
        sourceType: "CaseReferral",
        sourceId: referral.id,
      },
      email: {
        subject: `NuCare: ${statusLabel}`,
        text: `เรียน ${existingReferral.advisor.name}\n\n${statusLabel}\nนักศึกษา: ${existingReferral.student.name} (${studentLabel})\nเหตุผลส่งต่อ: ${existingReferral.reason}\n\nเข้าสู่ระบบเพื่อติดตาม`,
      },
    });

    await closeReferralReceivedAlerts(referral.id);

    await writeAuditLog({
      actorUserId: userId,
      action: "student-development.referral.update-status",
      entityType: "CaseReferral",
      entityId: referral.id,
      description: formatAuditMetadata({ status: nextStatus }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message:
        nextStatus === ReferralStatus.ACCEPTED
          ? "รับเคสสำเร็จ"
          : nextStatus === ReferralStatus.CLOSED
            ? "ปิดเคสสำเร็จ"
            : "อัปเดตสถานะสำเร็จ",
      referral,
    });
  } catch (error) {
    console.error("Update student development referral status error:", error);
    res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่" });
  }
};

/** รับช่วงเคสสวัสดิการที่กำลังประสานของเพื่อนร่วมทีม — อัปเดต acceptedBy เป็นผู้ล็อกอิน */
export const claimStudentDevelopmentReferral = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT_DEVELOPMENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = referralParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid referral id" });
    return;
  }

  try {
    const existingReferral = await prisma.caseReferral.findFirst({
      where: {
        id: parsedParams.data.referralId,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
      },
      select: {
        id: true,
        status: true,
        reason: true,
        acceptedByUserId: true,
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
          },
        },
        advisor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        acceptedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!existingReferral) {
      res.status(404).json({ message: "Referral not found" });
      return;
    }

    const decision = decideWelfareClaim(
      existingReferral.status,
      existingReferral.acceptedByUserId,
      userId
    );
    if (!decision.ok) {
      res.status(400).json({ message: decision.message });
      return;
    }

    if (decision.alreadyOwner) {
      res.status(200).json({
        message: "คุณเป็นผู้ประสานเคสนี้อยู่แล้ว",
        referral: {
          id: existingReferral.id,
          status: existingReferral.status,
          acceptedByUserId: existingReferral.acceptedByUserId,
        },
      });
      return;
    }

    const previousOwner = existingReferral.acceptedBy;

    const updated = await prisma.caseReferral.updateMany({
      where: {
        id: existingReferral.id,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        status: ReferralStatus.ACCEPTED,
      },
      data: {
        acceptedByUserId: userId,
      },
    });

    if (updated.count === 0) {
      res.status(409).json({ message: "สถานะเคสเปลี่ยนไปแล้ว กรุณารีเฟรชแล้วลองใหม่" });
      return;
    }

    const referral = await prisma.caseReferral.findUniqueOrThrow({
      where: { id: existingReferral.id },
      select: {
        id: true,
        status: true,
        acceptedByUserId: true,
        updatedAt: true,
      },
    });

    const studentLabel =
      formatStudentIdForResponse(existingReferral.student.studentId) || existingReferral.student.name;

    if (previousOwner?.id && previousOwner.id !== userId) {
      await notifyUser({
        recipientUserId: previousOwner.id,
        recipientEmail: previousOwner.email,
        channels: { inApp: true, email: Boolean(previousOwner.email) },
        alert: {
          actorUserId: userId,
          studentId: existingReferral.student.id,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: "มีผู้รับช่วงเคสสวัสดิการ",
          message: `${existingReferral.student.name} (${studentLabel}) · เพื่อนในทีมรับช่วงประสานต่อ`,
          sourceType: "CaseReferral",
          sourceId: referral.id,
        },
        email: {
          subject: "NuCare: มีผู้รับช่วงเคสสวัสดิการ",
          text: `เรียน ${previousOwner.name}\n\nเคสของ ${existingReferral.student.name} (${studentLabel}) ถูกเพื่อนร่วมทีมรับช่วงประสานต่อแล้ว\n`,
        },
      });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "student-development.referral.claim",
      entityType: "CaseReferral",
      entityId: referral.id,
      description: formatAuditMetadata({
        previousAcceptedByUserId: existingReferral.acceptedByUserId,
      }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "รับช่วงเคสสำเร็จ",
      referral,
    });
  } catch (error) {
    console.error("Claim student development referral error:", error);
    res.status(500).json({ message: "รับช่วงเคสไม่สำเร็จ กรุณาลองใหม่" });
  }
};

/** ส่งแจ้งเตือนให้นิสิตในกลุ่มค้างประเมิน (ตรงกับแดชบอร์ด) */
export const createStudentDevelopmentReminder = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT_DEVELOPMENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createReminderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const requestedIds = parsed.data.studentUserIds?.length
      ? Array.from(new Set(parsed.data.studentUserIds))
      : null;

    const candidates = await prisma.user.findMany({
      where: {
        ...(requestedIds ? { id: { in: requestedIds } } : {}),
        role: Role.STUDENT,
        isActive: true,
      },
      select: pendingStudentSelect,
      take: STUDENT_DEVELOPMENT_STUDENT_MAX_RESULTS,
    });

    const pendingCandidates = candidates.filter(isStudentDevelopmentPendingAssessment);
    if (requestedIds) {
      const pendingIdSet = new Set(pendingCandidates.map((student) => student.id));
      const rejected = requestedIds.filter((id) => !pendingIdSet.has(id));
      if (rejected.length > 0) {
        res.status(400).json({
          message: "ส่งได้เฉพาะนิสิตที่ค้างประเมินตามแดชบอร์ด",
          rejectedCount: rejected.length,
        });
        return;
      }
    }

    const recipients = pendingCandidates.map((student) => ({
      id: student.id,
      email: student.email,
      name: student.name,
    }));

    if (recipients.length === 0) {
      res.status(404).json({ message: "ไม่พบนิสิตที่ค้างประเมิน" });
      return;
    }

    const sendInApp = parsed.data.sendInApp !== false;
    const sendEmail = parsed.data.sendEmail === true;
    if (!sendInApp && !sendEmail) {
      res.status(400).json({ message: "เลือกอย่างน้อยหนึ่งช่องทางแจ้งเตือน" });
      return;
    }

    if (sendInApp) {
      await prisma.alert.createMany({
        data: recipients.map((student) => ({
          recipientUserId: student.id,
          actorUserId: userId,
          studentId: student.id,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: "โปรดทำแบบประเมินสุขภาพจิตในระบบ NuCare",
          message: parsed.data.message,
          sourceType: "StudentDevelopmentReminder",
        })),
      });
    }

    let emailSentCount = 0;
    if (sendEmail) {
      const { sendAppEmail } = await import("../lib/email/index.js");
      const subject = "โปรดทำแบบประเมินสุขภาพจิตในระบบ NuCare";
      const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
      const safeMessage = escapeHtmlForEmail(parsed.data.message);
      const withEmail = recipients.filter((student) => Boolean(student.email));
      const results = await Promise.all(
        withEmail.map((student) =>
          sendAppEmail({
            to: student.email as string,
            subject,
            text: `${parsed.data.message}\n\nเข้าสู่ระบบ: ${clientOrigin}`,
            html: `<p>${safeMessage.replace(/\n/g, "<br/>")}</p><p><a href="${clientOrigin}">เข้าสู่ระบบ NuCare</a></p>`,
          })
        )
      );
      emailSentCount = results.filter((result) => result.ok).length;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "student-development.reminder.create",
      entityType: "Alert",
      description: formatAuditMetadata({
        recipientCount: recipients.length,
        inApp: sendInApp,
        emailSentCount,
      }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งแจ้งเตือนสำเร็จ",
      sentCount: recipients.length,
      emailSentCount,
      channels: { inApp: sendInApp, email: sendEmail },
    });
  } catch (error) {
    console.error("Create student development reminder error:", error);
    res.status(500).json({ message: "Failed to create reminders" });
  }
};
