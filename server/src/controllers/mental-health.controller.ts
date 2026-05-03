import { AlertStatus, ReferralStatus, ReferralTarget, Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import { getAcceptedReferralOwners } from "../lib/referral-ownership";
import { hasAssignedRole } from "../lib/roles";
import { formatStudentIdForResponse, inferStudyYear, normalizeRiskLevel } from "../lib/user-format";

const referralParamSchema = z.object({
  referralId: z.string().trim().min(1),
});

const emergencyCaseParamSchema = z.object({
  caseId: z.string().trim().min(1),
});

const updateReferralStatusSchema = z.object({
  status: z.nativeEnum(ReferralStatus),
});

const createSpecializedCareRecordSchema = z.object({
  studentId: z.string().trim().min(1),
  referralId: z.string().trim().optional(),
  sessionDate: z.string().trim().min(1),
  summary: z.string().trim().min(1).max(4000),
  interventionPlan: z.string().trim().min(1).max(4000),
  confidentialNotes: z.string().trim().max(4000).optional(),
});

export const getMentalHealthDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const [referrals, emergencyCases, alerts] = await Promise.all([
      prisma.caseReferral.findMany({
        where: {
          target: "COUNSELING_CENTER",
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          student: {
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
          specializedCareRecords: {
            orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: {
              sessionDate: true,
              createdAt: true,
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
      }),
      prisma.emergencyCase.findMany({
        where: {
          status: {
            in: ["OPEN", "IN_PROGRESS"],
          },
        },
        orderBy: { openedAt: "desc" },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              studentId: true,
            },
          },
        },
      }),
      prisma.alert.findMany({
        where: {
          recipientUserId: userId,
          status: AlertStatus.OPEN,
          OR: [
            { type: "HIGH_RISK_SCREENING" },
            { type: "SOS_OPENED" },
            { type: "REFERRAL_RECEIVED" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const acceptedOwnerByReferralId = await getAcceptedReferralOwners(referrals.map((referral) => referral.id));

    res.status(200).json({
      referrals: referrals.map((referral) => {
        const latestCareRecord = referral.specializedCareRecords[0] ?? null;
        const acceptedOwner = acceptedOwnerByReferralId.get(referral.id) ?? null;

        return {
          id: referral.id,
          status: referral.status,
          reason: referral.reason,
          isUrgent: referral.isUrgent,
          createdAt: referral.createdAt,
          updatedAt: referral.updatedAt,
          advisorName: referral.advisor.name,
          currentOwnerName: latestCareRecord?.mentalHealthUser.name ?? acceptedOwner?.actorName ?? null,
          currentOwnerAssignedAt: acceptedOwner?.createdAt ?? null,
          careSessionCount: referral._count.specializedCareRecords,
          latestCareSessionAt: latestCareRecord?.sessionDate ?? null,
          student: {
            id: referral.student.id,
            studentId: formatStudentIdForResponse(referral.student.studentId),
            name: referral.student.name,
            year: inferStudyYear(referral.student.studentId, referral.student.studyYear),
            riskLevel: normalizeRiskLevel(referral.student.studentAssessments[0]?.riskLevel || "NORMAL"),
            latestAssessment: referral.student.studentAssessments[0] || null,
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
        },
      })),
      alerts,
    });
  } catch (error) {
    console.error("Get mental health dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch mental health dashboard" });
  }
};

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
      },
    });

    if (!existingReferral) {
      res.status(404).json({ message: "Referral not found" });
      return;
    }

    const referral = await prisma.caseReferral.update({
      where: { id: existingReferral.id },
      data: { status: parsedBody.data.status },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.referral.update-status",
      entityType: "CaseReferral",
      entityId: referral.id,
      description: `อัปเดตสถานะ referral เป็น ${parsedBody.data.status}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "อัปเดตสถานะ referral สำเร็จ",
      referral,
    });
  } catch (error) {
    console.error("Update referral status error:", error);
    res.status(500).json({ message: "Failed to update referral status" });
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
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
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

    const referralId = parsed.data.referralId?.trim() || null;
    if (referralId) {
      const referral = await prisma.caseReferral.findFirst({
        where: {
          id: referralId,
          target: ReferralTarget.COUNSELING_CENTER,
        },
        select: {
          id: true,
          studentId: true,
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

export const resolveEmergencyCase = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.MENTAL_HEALTH)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = emergencyCaseParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid emergency case id" });
    return;
  }

  try {
    const existingCase = await prisma.emergencyCase.findUnique({
      where: { id: parsedParams.data.caseId },
      select: {
        id: true,
      },
    });

    if (!existingCase) {
      res.status(404).json({ message: "Emergency case not found" });
      return;
    }

    const emergencyCase = await prisma.emergencyCase.update({
      where: { id: existingCase.id },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "mental-health.emergency.resolve",
      entityType: "EmergencyCase",
      entityId: emergencyCase.id,
      description: "ปิดเคสฉุกเฉิน",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "ปิดเคสฉุกเฉินสำเร็จ",
      emergencyCase,
    });
  } catch (error) {
    console.error("Resolve emergency case error:", error);
    res.status(500).json({ message: "Failed to resolve emergency case" });
  }
};
