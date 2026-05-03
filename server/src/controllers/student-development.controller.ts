import { AlertPriority, AlertType, ReferralStatus, ReferralTarget, Role, RiskLevel } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import { hasAssignedRole } from "../lib/roles";
import { formatStudentIdForResponse, inferStudyYear, normalizeRiskLevel } from "../lib/user-format";

const createReminderSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  studentUserIds: z.array(z.string().trim().min(1)).max(500).optional(),
});

const mapPendingStatus = (reminderAt: Date | null): string =>
  reminderAt ? "แจ้งเตือนแล้ว รอทำแบบประเมิน" : "ยังไม่พบผลประเมิน";

const normalizeScore = (riskLevel: RiskLevel | undefined): "normal" | "medium" | "high" => {
  return normalizeRiskLevel(riskLevel ?? RiskLevel.NORMAL);
};

export const getStudentDevelopmentDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.STUDENT_DEVELOPMENT)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const [students, referrals] = await Promise.all([
      prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          isActive: true,
        },
        select: {
          id: true,
          studentId: true,
          studyYear: true,
          section: true,
          name: true,
          createdAt: true,
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
        },
        orderBy: [{ studyYear: "asc" }, { studentId: "asc" }, { createdAt: "asc" }],
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
              studentCareRecords: {
                orderBy: [{ careDate: "desc" }, { createdAt: "desc" }],
                take: 1,
                select: {
                  careDate: true,
                  careType: true,
                  outcome: true,
                },
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      }),
    ]);

    const pendingStudentIds = students
      .filter((student) => student.studentAssessments.length === 0)
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
        })
      : [];

    const latestReminderByStudentId = new Map<string, Date>();
    latestReminderLogs.forEach((alert) => {
      if (!latestReminderByStudentId.has(alert.recipientUserId)) {
        latestReminderByStudentId.set(alert.recipientUserId, alert.createdAt);
      }
    });

    const assessedStudents = students.filter((student) => student.studentAssessments.length > 0);
    const normalRiskCount = assessedStudents.filter(
      (student) => normalizeScore(student.studentAssessments[0]?.riskLevel) === "normal"
    ).length;
    const mediumRiskCount = assessedStudents.filter(
      (student) => normalizeScore(student.studentAssessments[0]?.riskLevel) === "medium"
    ).length;
    const highRiskCount = assessedStudents.filter(
      (student) => normalizeScore(student.studentAssessments[0]?.riskLevel) === "high"
    ).length;

    const pendingStudents = students
      .filter((student) => student.studentAssessments.length === 0)
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
        title: "กลุ่มปกติพร้อมกิจกรรมส่งเสริม",
        tone: "normal",
        count: normalRiskCount,
        description: "ใช้วางกิจกรรมเสริมพลังใจเชิงป้องกันสำหรับนักศึกษาที่มีสัญญาณคงที่",
      },
      {
        id: "medium",
        title: "กลุ่มต้องติดตามเชิงป้องกัน",
        tone: "attention",
        count: mediumRiskCount,
        description: "เหมาะกับกิจกรรมกลุ่มเล็กหรือการติดตามร่วมกับอาจารย์ที่ปรึกษา",
      },
      {
        id: "high",
        title: "กลุ่มต้องส่งต่อหรือประสานใกล้ชิด",
        tone: "critical",
        count: highRiskCount,
        description: "ใช้ระบุเคสที่ควรจับตาและประสานทีมผู้เชี่ยวชาญอย่างใกล้ชิด",
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
        advisorName: referral.advisor.name,
        student: {
          id: referral.student.id,
          name: referral.student.name,
          studentCode: formatStudentIdForResponse(referral.student.studentId),
          year: inferStudyYear(referral.student.studentId, referral.student.studyYear),
          section: referral.student.section || "-",
          riskLevel: normalizeScore(referral.student.studentAssessments[0]?.riskLevel),
          latestAssessment: referral.student.studentAssessments[0] ?? null,
        },
        latestCareRecord: referral.student.studentCareRecords[0] ?? null,
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

    const totalTarget = students.length;
    const completed = assessedStudents.length;
    const pending = pendingStudents.length;
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
      pendingStudents,
      riskInsights,
      supportCases,
    });
  } catch (error) {
    console.error("Get student development dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch student development dashboard" });
  }
};

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
    const recipients = await prisma.user.findMany({
      where: {
        id: parsed.data.studentUserIds?.length
          ? {
              in: parsed.data.studentUserIds,
            }
          : undefined,
        role: Role.STUDENT,
        isActive: true,
        studentAssessments: parsed.data.studentUserIds?.length
          ? undefined
          : {
              none: {},
            },
      },
      select: {
        id: true,
      },
    });

    if (recipients.length === 0) {
      res.status(404).json({ message: "No matching students found" });
      return;
    }

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

    await writeAuditLog({
      actorUserId: userId,
      action: "student-development.reminder.create",
      entityType: "Alert",
      description: `Student development sent ${recipients.length} screening reminder(s)`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "Reminders created successfully",
      sentCount: recipients.length,
    });
  } catch (error) {
    console.error("Create student development reminder error:", error);
    res.status(500).json({ message: "Failed to create reminders" });
  }
};
