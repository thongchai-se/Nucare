import {
  AlertPriority,
  AlertStatus,
  AlertType,
  EmergencyCaseStatus,
  MentalHealthAppointmentStatus,
  ReferralStatus,
  ReferralTarget,
  Role,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import {
  canTransitionEmergencyCaseStatus,
  emergencyCaseStatusLabel,
  emergencyCaseTransitionError,
} from "../lib/emergency-case-status";
import { canUpdateMentalHealthAppointmentStatus } from "../lib/mental-health-appointment-status";
import {
  buildScheduledAt,
  serializeMentalHealthAppointment,
} from "../lib/mental-health-appointments";
import {
  canTransitionMentalHealthReferralStatus,
  mentalHealthReferralTransitionError,
} from "../lib/mental-health-referral-status";
import {
  canMutateAcceptedReferral,
  mentalHealthOwnershipDeniedMessage,
} from "../lib/mental-health-ownership";
import {
  getMentalHealthStudentHistory,
  getMentalHealthStudentHistoryByReferral,
} from "../lib/mental-health-student-history";
import { closeReferralReceivedAlerts } from "../lib/close-referral-alerts";
import { closeSosAlertsForCase } from "../lib/notify-sos-recipients";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import { getAcceptedReferralOwners } from "../lib/referral-ownership";
import { hasAssignedRole } from "../lib/roles";
import { getLatestActiveSurveyResultsForStudents } from "../lib/survey-results";
import { formatStudentIdForResponse, inferStudyYear, normalizeRiskLevel } from "../lib/user-format";

const referralParamSchema = z.object({
  referralId: z.string().trim().min(1),
});

const studentParamSchema = z.object({
  studentUserId: z.string().trim().min(1),
});

const updateReferralStatusSchema = z.object({
  status: z.nativeEnum(ReferralStatus),
});

const createSpecializedCareRecordSchema = z
  .object({
    studentId: z.string().trim().min(1),
    referralId: z.string().trim().min(1),
    sessionDate: z.string().trim().min(1),
    summary: z.string().trim().min(1).max(4000),
    interventionPlan: z.string().trim().min(1).max(4000),
    confidentialNotes: z.string().trim().max(4000).optional(),
  })
  .strict();

const createAppointmentSchema = z
  .object({
    studentId: z.string().trim().min(1),
    referralId: z.string().trim().min(1),
    date: z.string().trim().min(1),
    time: z.string().trim().min(1),
    location: z.string().trim().min(1).max(200),
    note: z.string().trim().max(1200).optional(),
  })
  .strict();

const appointmentParamSchema = z.object({
  appointmentId: z.string().trim().min(1),
});

const updateAppointmentStatusSchema = z.object({
  status: z.enum([
    MentalHealthAppointmentStatus.CANCELLED,
    MentalHealthAppointmentStatus.COMPLETED,
    MentalHealthAppointmentStatus.NO_SHOW,
  ]),
});

const emergencyCaseParamSchema = z
  .object({
    caseId: z.string().trim().min(1),
  })
  .strict();

const updateEmergencyCaseStatusSchema = z
  .object({
    status: z.nativeEnum(EmergencyCaseStatus),
  })
  .strict();

const MENTAL_HEALTH_DASHBOARD_FEED_MAX_RESULTS = 50;
const MENTAL_HEALTH_APPOINTMENT_FEED_MAX_RESULTS = 100;

export const getMentalHealthDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const referralInclude = {
      student: {
        select: {
          id: true,
          studentId: true,
          studyYear: true,
          name: true,
          studentAssessments: {
            orderBy: { assessedAt: "desc" as const },
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
      advisor: {
        select: {
          name: true,
        },
      },
      acceptedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      specializedCareRecords: {
        orderBy: [{ sessionDate: "desc" as const }, { createdAt: "desc" as const }],
        take: 5,
        select: {
          id: true,
          sessionDate: true,
          createdAt: true,
          summary: true,
          interventionPlan: true,
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
    };

    const [openReferrals, closedReferrals, emergencyCases, alerts, appointments] = await Promise.all([
      // คิวเปิดต้องไม่ถูกตัดทิ้ง — PENDING/ACCEPTED โหลดครบ
      prisma.caseReferral.findMany({
        where: {
          target: ReferralTarget.COUNSELING_CENTER,
          status: { in: [ReferralStatus.PENDING, ReferralStatus.ACCEPTED] },
        },
        orderBy: [{ isUrgent: "desc" }, { createdAt: "desc" }],
        take: 500,
        include: referralInclude,
      }),
      prisma.caseReferral.findMany({
        where: {
          target: ReferralTarget.COUNSELING_CENTER,
          status: ReferralStatus.CLOSED,
        },
        orderBy: { updatedAt: "desc" },
        take: MENTAL_HEALTH_DASHBOARD_FEED_MAX_RESULTS,
        include: referralInclude,
      }),
      prisma.emergencyCase.findMany({
        where: {
          // เฉพาะ SOS ที่นิสิตกดเอง — เคส auto จากคัดกรองไม่โผล่ในคิวช่วยเหลือด่วน
          reportedByUserId: { not: null },
          status: {
            in: [EmergencyCaseStatus.OPEN, EmergencyCaseStatus.IN_PROGRESS],
          },
        },
        orderBy: { openedAt: "desc" },
        take: MENTAL_HEALTH_DASHBOARD_FEED_MAX_RESULTS,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              studentId: true,
              studyYear: true,
            },
          },
        },
      }),
      prisma.alert.findMany({
        where: {
          recipientUserId: userId,
          status: AlertStatus.OPEN,
          OR: [
            { type: AlertType.HIGH_RISK_SCREENING },
            { type: AlertType.REFERRAL_RECEIVED },
            { type: AlertType.SOS_OPENED },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: MENTAL_HEALTH_DASHBOARD_FEED_MAX_RESULTS,
      }),
      prisma.mentalHealthAppointment.findMany({
        where: {
          OR: [
            { status: MentalHealthAppointmentStatus.SCHEDULED },
            {
              status: {
                in: [
                  MentalHealthAppointmentStatus.COMPLETED,
                  MentalHealthAppointmentStatus.CANCELLED,
                  MentalHealthAppointmentStatus.NO_SHOW,
                ],
              },
              scheduledAt: {
                gte: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
        orderBy: { scheduledAt: "desc" },
        take: MENTAL_HEALTH_APPOINTMENT_FEED_MAX_RESULTS,
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
    ]);

    const referrals = [...openReferrals, ...closedReferrals];
    const acceptedOwnerByReferralId = await getAcceptedReferralOwners(referrals.map((referral) => referral.id));
    const latestSurveyByStudentId = await getLatestActiveSurveyResultsForStudents(
      referrals.map((referral) => referral.student.id)
    );

    res.status(200).json({
      referrals: referrals.map((referral) => {
        const latestCareRecord = referral.specializedCareRecords[0] ?? null;
        const acceptedOwner = acceptedOwnerByReferralId.get(referral.id) ?? null;
        const latestSurvey = latestSurveyByStudentId.get(referral.student.id);
        const latestAssessment = referral.student.studentAssessments[0] ?? null;

        return {
          id: referral.id,
          status: referral.status,
          reason: referral.reason,
          isUrgent: referral.isUrgent,
          createdAt: referral.createdAt,
          updatedAt: referral.updatedAt,
          advisorName: referral.advisor.name,
          acceptedByUserId: referral.acceptedByUserId ?? null,
          currentOwnerName:
            referral.acceptedBy?.name ?? acceptedOwner?.actorName ?? latestCareRecord?.mentalHealthUser.name ?? null,
          currentOwnerAssignedAt: acceptedOwner?.createdAt ?? null,
          careSessionCount: referral._count.specializedCareRecords,
          latestCareSessionAt: latestCareRecord?.sessionDate ?? null,
          recentCareSessions: referral.specializedCareRecords.map((record) => ({
            id: record.id,
            sessionDate: record.sessionDate,
            summary: record.summary,
            interventionPlan: record.interventionPlan,
            providerName: record.mentalHealthUser.name,
            createdAt: record.createdAt,
          })),
          student: {
            id: referral.student.id,
            studentId: formatStudentIdForResponse(referral.student.studentId),
            name: referral.student.name,
            year: inferStudyYear(referral.student.studentId, referral.student.studyYear),
            riskLevel: normalizeRiskLevel(latestSurvey?.riskLevel ?? latestAssessment?.riskLevel ?? "NORMAL"),
            latestAssessment: latestSurvey
              ? {
                  totalScore: latestSurvey.totalScore,
                  instrument: latestSurvey.instrument,
                  assessedAt: latestSurvey.assessedAt,
                }
              : latestAssessment,
          },
        };
      }),
      emergencyCases: emergencyCases.map((item) => ({
        id: item.id,
        summary: item.summary,
        status: item.status,
        openedAt: item.openedAt,
        student: {
          id: item.student.id,
          name: item.student.name,
          studentId: formatStudentIdForResponse(item.student.studentId),
          year: inferStudyYear(item.student.studentId, item.student.studyYear),
        },
      })),
      alerts,
      appointments: appointments.map(serializeMentalHealthAppointment),
    });
  } catch (error) {
    console.error("Get mental health dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch mental health dashboard" });
  }
};

/** อัปเดตสถานะเคส SOS: รอรับ → กำลังดำเนินการ → ปิดแล้ว */
export const updateEmergencyCaseStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = emergencyCaseParamSchema.safeParse(req.params);
  const parsedBody = updateEmergencyCaseStatusSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  try {
    const existing = await prisma.emergencyCase.findUnique({
      where: { id: parsedParams.data.caseId },
      select: {
        id: true,
        status: true,
        summary: true,
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            email: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Emergency case not found" });
      return;
    }

    const nextStatus = parsedBody.data.status;
    if (!canTransitionEmergencyCaseStatus(existing.status, nextStatus)) {
      res.status(400).json({
        message: emergencyCaseTransitionError(existing.status, nextStatus),
      });
      return;
    }

    const claimed = await prisma.emergencyCase.updateMany({
      where: {
        id: existing.id,
        status: existing.status,
      },
      data: {
        status: nextStatus,
        ...(nextStatus === EmergencyCaseStatus.RESOLVED
          ? { resolvedAt: new Date() }
          : {}),
      },
    });

    if (claimed.count === 0) {
      res.status(409).json({ message: "สถานะเคสเปลี่ยนไปแล้ว กรุณารีเฟรชแล้วลองใหม่" });
      return;
    }

    if (nextStatus === EmergencyCaseStatus.RESOLVED) {
      await closeSosAlertsForCase(existing.id);
    } else if (nextStatus === EmergencyCaseStatus.IN_PROGRESS) {
      await prisma.alert.updateMany({
        where: {
          recipientUserId: userId,
          sourceType: "EmergencyCase",
          sourceId: existing.id,
          status: AlertStatus.OPEN,
        },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
          acknowledgedAt: new Date(),
        },
      });
    }

    const emergencyCase = await prisma.emergencyCase.findUniqueOrThrow({
      where: { id: existing.id },
      select: {
        id: true,
        status: true,
        summary: true,
        openedAt: true,
        resolvedAt: true,
      },
    });

    const studentLabel =
      formatStudentIdForResponse(existing.student.studentId) || existing.student.name;
    const statusLabel = emergencyCaseStatusLabel(nextStatus);

    await notifyUser({
      recipientUserId: existing.student.id,
      recipientEmail: existing.student.email,
      channels: { inApp: true, email: Boolean(existing.student.email) },
      alert: {
        actorUserId: userId,
        studentId: existing.student.id,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.HIGH,
        title: `ทีมดูแลอัปเดตคำขอช่วยเหลือด่วน: ${statusLabel}`,
        message: `สถานะคำขอของคุณเป็น「${statusLabel}」 หากฉุกเฉินให้โทร 1323 ได้ทันที`,
        sourceType: "EmergencyCase",
        sourceId: emergencyCase.id,
      },
      email: {
        subject: `NuCare: คำขอช่วยเหลือด่วน — ${statusLabel}`,
        text: `เรียน ${existing.student.name}\n\nทีมดูแลอัปเดตคำขอช่วยเหลือด่วนของคุณเป็น「${statusLabel}」\nรหัส: ${studentLabel}\n\nหากฉุกเฉินให้โทร 1323 ได้ทันที`,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action:
        nextStatus === EmergencyCaseStatus.RESOLVED
          ? "mental-health.emergency.resolve"
          : "mental-health.emergency.update-status",
      entityType: "EmergencyCase",
      entityId: emergencyCase.id,
      description: `อัปเดตสถานะ SOS เป็น ${nextStatus}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message:
        nextStatus === EmergencyCaseStatus.RESOLVED
          ? "ปิดเคสฉุกเฉินสำเร็จ"
          : nextStatus === EmergencyCaseStatus.IN_PROGRESS
            ? "รับดำเนินการเคสฉุกเฉินแล้ว"
            : "อัปเดตสถานะสำเร็จ",
      emergencyCase,
    });
  } catch (error) {
    console.error("Update emergency case status error:", error);
    res.status(500).json({ message: "อัปเดตสถานะเคสฉุกเฉินไม่สำเร็จ" });
  }
};

/** ประวัตินิสิตครบสำหรับผู้เชี่ยวชาญ — นัด บันทึกผล บริบทที่ปรึกษา/ประเมิน */
export const getMentalHealthStudentHistoryDetail = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = studentParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "รหัสนักศึกษาไม่ถูกต้อง" });
    return;
  }

  try {
    const result = await getMentalHealthStudentHistory(
      prisma,
      userId,
      parsedParams.data.studentUserId
    );
    if (result === "forbidden") {
      res.status(403).json({ message: "ไม่มีสิทธิ์ดูประวัตินักศึกษานี้" });
      return;
    }
    if (result === "not_found") {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.student-history.view",
      entityType: "User",
      entityId: result.student.id,
      description: "ผู้เชี่ยวชาญเปิดดูประวัตินักศึกษา",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Get mental health student history error:", error);
    res.status(500).json({ message: "โหลดประวัติไม่สำเร็จ กรุณาลองใหม่" });
  }
};

/** ประวัติจากรายการส่งต่อ — ใช้ได้แม้ยังไม่กดรับเคส */
export const getMentalHealthReferralHistoryDetail = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = referralParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "รายการส่งต่อไม่ถูกต้อง" });
    return;
  }

  try {
    const result = await getMentalHealthStudentHistoryByReferral(
      prisma,
      userId,
      parsedParams.data.referralId
    );
    if (result === "forbidden") {
      res.status(403).json({ message: "ไม่มีสิทธิ์ดูประวัตินักศึกษานี้" });
      return;
    }
    if (result === "not_found") {
      res.status(404).json({ message: "ไม่พบรายการส่งต่อหรือนักศึกษา" });
      return;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.referral-history.view",
      entityType: "CaseReferral",
      entityId: parsedParams.data.referralId,
      description: "ผู้เชี่ยวชาญเปิดดูประวัติจากคิวส่งต่อ",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Get mental health referral history error:", error);
    res.status(500).json({ message: "โหลดประวัติไม่สำเร็จ กรุณาลองใหม่" });
  }
};

/** สร้างนัดหมายศูนย์ให้คำปรึกษาให้นิสิตที่มี referral ที่รับแล้ว */
export const createMentalHealthAppointment = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const scheduledAt = buildScheduledAt(parsed.data.date, parsed.data.time);
  if (!scheduledAt) {
    res.status(400).json({ message: "รูปแบบวันหรือเวลาไม่ถูกต้อง" });
    return;
  }

  try {
    const student = await prisma.user.findFirst({
      where: {
        id: parsed.data.studentId,
        role: Role.STUDENT,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    const activeReferral = await prisma.caseReferral.findFirst({
      where: {
        id: parsed.data.referralId,
        studentId: student.id,
        target: ReferralTarget.COUNSELING_CENTER,
        status: ReferralStatus.ACCEPTED,
      },
      select: {
        id: true,
        acceptedByUserId: true,
      },
    });

    if (!activeReferral) {
      res.status(400).json({ message: "Student must have an accepted counseling referral" });
      return;
    }

    if (!canMutateAcceptedReferral(activeReferral.acceptedByUserId, userId)) {
      res.status(403).json({ message: mentalHealthOwnershipDeniedMessage() });
      return;
    }

    const appointment = await prisma.mentalHealthAppointment.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: userId,
        referralId: activeReferral.id,
        scheduledAt,
        location: parsed.data.location,
        note: parsed.data.note?.trim() || null,
        status: MentalHealthAppointmentStatus.SCHEDULED,
      },
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
    });

    const whenLabel = appointment.scheduledAt.toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    const locationLabel = appointment.location?.trim() || "ตามที่นัดหมาย";
    await notifyUser({
      recipientUserId: student.id,
      recipientEmail: student.email,
      channels: { inApp: true, email: Boolean(student.email) },
      alert: {
        actorUserId: userId,
        studentId: student.id,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: "มีการนัดหมายกับทีมสุขภาพจิต",
        message: `วันเวลา ${whenLabel} · สถานที่ ${locationLabel}`,
        sourceType: "MentalHealthAppointment",
        sourceId: appointment.id,
      },
      email: {
        subject: "NuCare: มีการนัดหมายกับทีมสุขภาพจิต",
        text: `เรียน ${student.name}\n\nมีการนัดหมายกับทีมสุขภาพจิต\nวันเวลา: ${whenLabel}\nสถานที่: ${locationLabel}\n\nเข้าสู่ระบบเพื่อดูรายละเอียด`,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.appointment.create",
      entityType: "MentalHealthAppointment",
      entityId: appointment.id,
      description: `สร้างนัดหมายให้ ${student.name}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "สร้างนัดหมายสำเร็จ",
      appointment: serializeMentalHealthAppointment(appointment),
    });
  } catch (error) {
    console.error("Create mental health appointment error:", error);
    res.status(500).json({ message: "Failed to create appointment" });
  }
};

/** ยกเลิกนัดหมายสุขภาพจิตที่ยังอยู่ในสถานะ SCHEDULED */
export const cancelMentalHealthAppointment = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = appointmentParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid appointment id" });
    return;
  }

  try {
    const existing = await prisma.mentalHealthAppointment.findUnique({
      where: { id: parsedParams.data.appointmentId },
      select: {
        id: true,
        status: true,
        mentalHealthUserId: true,
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Appointment not found" });
      return;
    }

    if (existing.mentalHealthUserId !== userId) {
      res.status(403).json({ message: mentalHealthOwnershipDeniedMessage() });
      return;
    }

    if (existing.status !== MentalHealthAppointmentStatus.SCHEDULED) {
      res.status(400).json({ message: "Only scheduled appointments can be cancelled" });
      return;
    }

    const appointment = await prisma.mentalHealthAppointment.update({
      where: { id: existing.id },
      data: {
        status: MentalHealthAppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
      },
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
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.appointment.cancel",
      entityType: "MentalHealthAppointment",
      entityId: appointment.id,
      description: "ยกเลิกนัดหมายสุขภาพจิต",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "ยกเลิกนัดหมายสำเร็จ",
      appointment: serializeMentalHealthAppointment(appointment),
    });
  } catch (error) {
    console.error("Cancel mental health appointment error:", error);
    res.status(500).json({ message: "Failed to cancel appointment" });
  }
};

/** ยกเลิกนัดหมายของตนเองที่ยังไม่ถึงทั้งหมด (จำกัดเฉพาะผู้สร้างนัด) */
export const clearScheduledMentalHealthAppointments = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const result = await prisma.mentalHealthAppointment.updateMany({
      where: {
        mentalHealthUserId: userId,
        status: MentalHealthAppointmentStatus.SCHEDULED,
      },
      data: {
        status: MentalHealthAppointmentStatus.CANCELLED,
        cancelledAt: new Date(),
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.appointment.clear-scheduled",
      entityType: "MentalHealthAppointment",
      description: `ยกเลิกนัดหมายที่ยังไม่ถึง ${result.count} รายการ`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "ยกเลิกนัดหมายที่ยังไม่ถึงแล้ว",
      cancelledCount: result.count,
    });
  } catch (error) {
    console.error("Clear mental health appointments error:", error);
    res.status(500).json({ message: "Failed to clear appointments" });
  }
};

/** อัปเดตสถานะคิวส่งต่อตามลำดับ PENDING→ACCEPTED→CLOSED และแจ้งที่ปรึกษา */
export const updateReferralStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
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
        target: ReferralTarget.COUNSELING_CENTER,
      },
      select: {
        id: true,
        status: true,
        reason: true,
        advisorId: true,
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
          target: ReferralTarget.COUNSELING_CENTER,
          status: ReferralStatus.ACCEPTED,
          id: { not: existingReferral.id },
        },
        select: { id: true },
      });
      if (otherAccepted) {
        res.status(409).json({
          message: "นิสิตคนนี้มีเคสที่กำลังดูแลอยู่แล้ว ไม่สามารถรับซ้ำได้",
        });
        return;
      }
    }

    // กันแข่งกดรับ/ปิดพร้อมกัน: อัปเดตเฉพาะเมื่อสถานะปัจจุบันยังตรงเงื่อนไข
    const claimed = await prisma.caseReferral.updateMany({
      where: {
        id: existingReferral.id,
        target: ReferralTarget.COUNSELING_CENTER,
        status: existingReferral.status,
      },
      data: {
        status: nextStatus,
        ...(nextStatus === ReferralStatus.ACCEPTED ? { acceptedByUserId: userId } : {}),
      },
    });

    if (claimed.count === 0) {
      const latest = await prisma.caseReferral.findUnique({
        where: { id: existingReferral.id },
        select: { status: true },
      });
      if (latest?.status === ReferralStatus.ACCEPTED && nextStatus === ReferralStatus.ACCEPTED) {
        res.status(409).json({ message: "เคสนี้มีผู้รับแล้ว กรุณารีเฟรชรายการ" });
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
        ? "ผู้เชี่ยวชาญรับเคสแล้ว"
        : existingReferral.status === ReferralStatus.PENDING
          ? "ผู้เชี่ยวชาญปิด/ปฏิเสธคิวส่งต่อ"
          : "ผู้เชี่ยวชาญปิดเคสแล้ว";

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
      action: "mental-health.referral.update-status",
      entityType: "CaseReferral",
      entityId: referral.id,
      description: `อัปเดตสถานะ referral เป็น ${nextStatus}`,
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
    console.error("Update referral status error:", error);
    res.status(500).json({ message: "อัปเดตสถานะไม่สำเร็จ กรุณาลองใหม่" });
  }
};

export const createSpecializedCareRecord = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createSpecializedCareRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  const sessionDate = new Date(parsed.data.sessionDate);
  if (Number.isNaN(sessionDate.getTime())) {
    res.status(400).json({ message: "รูปแบบวันที่ไม่ถูกต้อง" });
    return;
  }

  try {
    const student = await prisma.user.findFirst({
      where: {
        id: parsed.data.studentId,
        role: Role.STUDENT,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    const referralId = parsed.data.referralId.trim();
    const referral = await prisma.caseReferral.findFirst({
      where: {
        id: referralId,
        target: ReferralTarget.COUNSELING_CENTER,
      },
      select: {
        id: true,
        studentId: true,
        status: true,
        acceptedByUserId: true,
      },
    });

    if (!referral) {
      res.status(404).json({ message: "Referral not found" });
      return;
    }

    if (referral.studentId !== student.id) {
      res.status(400).json({ message: "Referral does not belong to this student" });
      return;
    }

    if (referral.status !== ReferralStatus.ACCEPTED) {
      res.status(400).json({ message: "บันทึกผลการปรึกษาได้เฉพาะเคสที่รับแล้ว" });
      return;
    }

    if (!canMutateAcceptedReferral(referral.acceptedByUserId, userId)) {
      res.status(403).json({ message: mentalHealthOwnershipDeniedMessage() });
      return;
    }

    const record = await prisma.specializedCareRecord.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: userId,
        referralId,
        sessionDate,
        summary: parsed.data.summary,
        interventionPlan: parsed.data.interventionPlan,
        confidentialNotes: parsed.data.confidentialNotes || null,
      },
      select: {
        id: true,
        sessionDate: true,
        summary: true,
        interventionPlan: true,
        referralId: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.specialized-care.create",
      entityType: "SpecializedCareRecord",
      entityId: record.id,
      description: "บันทึกการดูแลเชิงลึก",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "บันทึกการดูแลเชิงลึกสำเร็จ",
      record,
    });
  } catch (error) {
    console.error("Create specialized care record error:", error);
    res.status(500).json({ message: "Failed to create specialized care record" });
  }
};

/** อัปเดตผลนัดหมาย: ยกเลิก / พบแล้ว / ไม่มาตามนัด */
export const updateMentalHealthAppointmentStatus = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = appointmentParamSchema.safeParse(req.params);
  const parsedBody = updateAppointmentStatusSchema.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ message: "Invalid payload" });
    return;
  }

  try {
    const existing = await prisma.mentalHealthAppointment.findUnique({
      where: { id: parsedParams.data.appointmentId },
      select: {
        id: true,
        status: true,
        studentId: true,
        mentalHealthUserId: true,
        student: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ message: "Appointment not found" });
      return;
    }

    if (existing.mentalHealthUserId !== userId) {
      res.status(403).json({ message: mentalHealthOwnershipDeniedMessage() });
      return;
    }

    const nextStatus = parsedBody.data.status;
    if (!canUpdateMentalHealthAppointmentStatus(existing.status, nextStatus)) {
      res.status(400).json({ message: "อัปเดตได้เฉพาะนัดที่ยังอยู่ในสถานะนัดหมาย" });
      return;
    }

    const appointment = await prisma.mentalHealthAppointment.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        cancelledAt: nextStatus === MentalHealthAppointmentStatus.CANCELLED ? new Date() : undefined,
      },
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
    });

    if (nextStatus === MentalHealthAppointmentStatus.CANCELLED) {
      await notifyUser({
        recipientUserId: existing.studentId,
        recipientEmail: existing.student.email,
        channels: { inApp: true, email: Boolean(existing.student.email) },
        alert: {
          actorUserId: userId,
          studentId: existing.studentId,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: "นัดหมายกับทีมสุขภาพจิตถูกยกเลิก",
          message: "กรุณาติดต่อทีมผู้เชี่ยวชาญหากต้องการนัดใหม่",
          sourceType: "MentalHealthAppointment",
          sourceId: appointment.id,
        },
        email: {
          subject: "NuCare: นัดหมายกับทีมสุขภาพจิตถูกยกเลิก",
          text: `เรียน ${existing.student.name}\n\nนัดหมายกับทีมสุขภาพจิตถูกยกเลิกแล้ว\nหากต้องการนัดใหม่ กรุณาติดต่อผ่านระบบหรือตามช่องทางที่คณะกำหนด`,
        },
      });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.appointment.update-status",
      entityType: "MentalHealthAppointment",
      entityId: appointment.id,
      description: `อัปเดตสถานะนัดหมายเป็น ${nextStatus}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "อัปเดตสถานะนัดหมายสำเร็จ",
      appointment: serializeMentalHealthAppointment(appointment),
    });
  } catch (error) {
    console.error("Update mental health appointment status error:", error);
    res.status(500).json({ message: "Failed to update appointment status" });
  }
};
