import { AlertPriority, AlertType, Prisma, ReferralTarget, Role, RiskLevel } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { canAccessStudent, getStudentScopeWhere, isAdvisorRole } from "../lib/access-control";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import {
  formatStudentIdForResponse,
  getUserInitials,
  inferStudyYear,
  normalizeRiskLevel,
} from "../lib/user-format";

const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

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

const normalizeSearch = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed || undefined;
};

const parseCareDate = (value: string): Date | null => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapReferralTargetLabel = (target: ReferralTarget): string =>
  target === ReferralTarget.COUNSELING_CENTER
    ? "ศูนย์ให้คำปรึกษา / ทีมจิตแพทย์"
    : "ฝ่ายพัฒนานักศึกษา";

const resolveStudent = async (studentUserId: string) =>
  prisma.user.findFirst({
    where: {
      id: studentUserId,
      role: Role.STUDENT,
    },
    select: {
      id: true,
      studentId: true,
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
) => item;

export const listAdvisorStudents = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const role = req.user?.role;
  if (!userId || !isAdvisorRole(role)) {
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
    const where = await getStudentScopeWhere(role, userId);
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
        name: true,
        studentAssessments: {
          orderBy: { assessedAt: "desc" },
          take: 1,
          select: {
            riskLevel: true,
            assessedAt: true,
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
    });

    res.status(200).json({
      students: students.map((student) => ({
        id: student.id,
        studentId: formatStudentIdForResponse(student.studentId),
        name: student.name,
        image: getUserInitials(student.name, "นศ"),
        year: inferStudyYear(student.studentId),
        riskLevel: normalizeRiskLevel(student.studentAssessments[0]?.riskLevel ?? RiskLevel.NORMAL),
        lastAssessment: student.studentAssessments[0]?.assessedAt ?? null,
        careRecordCount: student._count.studentCareRecords,
        behaviorRecordCount: student._count.studentBehaviorRecords,
        latestScore: student.studentAssessments[0]?.totalScore ?? null,
        latestInstrument: student.studentAssessments[0]?.instrument ?? null,
      })),
      total: students.length,
    });
  } catch (error) {
    console.error("List advisor students error:", error);
    res.status(500).json({ message: "Failed to list students" });
  }
};

export const getStudentHistory = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const role = req.user?.role;
  if (!userId || !isAdvisorRole(role)) {
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
    const canView = await canAccessStudent(role, userId, parsedParams.data.studentUserId);
    if (!canView) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const student = await resolveStudent(parsedParams.data.studentUserId);
    if (!student) {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    const [careRecords, referrals, behaviorRecords] = await Promise.all([
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
    ]);

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
    ].sort((left, right) => right.date.getTime() - left.date.getTime());

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
        year: inferStudyYear(student.studentId),
        riskLevel: normalizeRiskLevel(student.studentAssessments[0]?.riskLevel ?? RiskLevel.NORMAL),
        lastAssessment: student.studentAssessments[0]?.assessedAt ?? null,
        careRecordCount: student._count.studentCareRecords,
        latestScore: student.studentAssessments[0]?.totalScore ?? null,
        latestInstrument: student.studentAssessments[0]?.instrument ?? null,
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
  const advisorRole = req.user?.role;

  if (!advisorId || !isAdvisorRole(advisorRole)) {
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
    const canView = await canAccessStudent(advisorRole, advisorId, parsedParams.data.studentUserId);
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
  const advisorRole = req.user?.role;

  if (!advisorId || !isAdvisorRole(advisorRole)) {
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
    const canView = await canAccessStudent(advisorRole, advisorId, parsedParams.data.studentUserId);
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

    const mentalHealthUsers = await prisma.user.findMany({
      where: {
        role: Role.MENTAL_HEALTH,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (parsedBody.data.target === ReferralTarget.COUNSELING_CENTER && mentalHealthUsers.length > 0) {
      await prisma.alert.createMany({
        data: mentalHealthUsers.map((user) => ({
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
