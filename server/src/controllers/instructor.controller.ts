import { AlertPriority, AlertStatus, AlertType, BehaviorSeverity, Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { canAccessStudent, getStudentScopeWhere } from "../lib/access-control";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import { formatStudentIdForResponse } from "../lib/user-format";

const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const createBehaviorRecordSchema = z.object({
  studentId: z.string().trim().min(1),
  observedAt: z.string().trim().min(1),
  category: z.string().trim().min(1).max(120),
  details: z.string().trim().min(1).max(4000),
  severity: z.nativeEnum(BehaviorSeverity),
});

const getBehaviorRecordFollowUpStatus = (
  statuses: AlertStatus[]
): "PENDING" | "ACKNOWLEDGED" | "COMPLETED" => {
  if (statuses.includes(AlertStatus.CLOSED)) {
    return "COMPLETED";
  }

  if (statuses.includes(AlertStatus.ACKNOWLEDGED)) {
    return "ACKNOWLEDGED";
  }

  return "PENDING";
};

export const listInstructorStudents = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!userId || !roles.includes(Role.INSTRUCTOR)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = listStudentsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid query", errors: parsed.error.flatten() });
    return;
  }

  const search = parsed.data.search?.trim();

  try {
    const where = await getStudentScopeWhere(roles, userId);
    const students = await prisma.user.findMany({
      where: {
        ...where,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { studentId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        studentId: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.status(200).json({
      students: students.map((student) => ({
        id: student.id,
        name: student.name,
        studentId: formatStudentIdForResponse(student.studentId),
      })),
    });
  } catch (error) {
    console.error("List instructor students error:", error);
    res.status(500).json({ message: "Failed to list instructor students" });
  }
};

export const listBehaviorRecords = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!userId || !roles.includes(Role.INSTRUCTOR)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const behaviorRecords = await prisma.behaviorRecord.findMany({
      where: {
        instructorId: userId,
      },
      select: {
        id: true,
        category: true,
        details: true,
        severity: true,
        observedAt: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const sourceIds = behaviorRecords.map((record) => record.id);
    const alerts =
      sourceIds.length > 0
        ? await prisma.alert.findMany({
            where: {
              sourceType: "BehaviorRecord",
              sourceId: {
                in: sourceIds,
              },
            },
            select: {
              sourceId: true,
              status: true,
              recipient: {
                select: {
                  name: true,
                },
              },
            },
          })
        : [];

    const alertsBySourceId = new Map<
      string,
      Array<{
        status: AlertStatus;
        recipientName: string;
      }>
    >();

    alerts.forEach((alert) => {
      const sourceId = alert.sourceId;
      if (!sourceId) {
        return;
      }

      const current = alertsBySourceId.get(sourceId) || [];
      current.push({
        status: alert.status,
        recipientName: alert.recipient.name,
      });
      alertsBySourceId.set(sourceId, current);
    });

    res.status(200).json({
      records: behaviorRecords.map((record) => {
        const relatedAlerts = alertsBySourceId.get(record.id) || [];

        return {
          id: record.id,
          category: record.category,
          details: record.details,
          severity: record.severity,
          observedAt: record.observedAt,
          createdAt: record.createdAt,
          status: getBehaviorRecordFollowUpStatus(relatedAlerts.map((alert) => alert.status)),
          advisorRecipients: Array.from(new Set(relatedAlerts.map((alert) => alert.recipientName))).filter(Boolean),
          student: {
            id: record.student.id,
            name: record.student.name,
            studentId: formatStudentIdForResponse(record.student.studentId),
          },
        };
      }),
    });
  } catch (error) {
    console.error("List instructor behavior records error:", error);
    res.status(500).json({ message: "Failed to list instructor behavior records" });
  }
};

export const createBehaviorRecord = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!userId || !roles.includes(Role.INSTRUCTOR)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createBehaviorRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const canAccess = await canAccessStudent(roles, userId, parsed.data.studentId);
    if (!canAccess) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const observedAt = new Date(parsed.data.observedAt);
    if (Number.isNaN(observedAt.getTime())) {
      res.status(400).json({ message: "รูปแบบวันที่ไม่ถูกต้อง" });
      return;
    }

    const behaviorRecord = await prisma.behaviorRecord.create({
      data: {
        studentId: parsed.data.studentId,
        instructorId: userId,
        observedAt,
        category: parsed.data.category,
        details: parsed.data.details,
        severity: parsed.data.severity,
      },
    });

    const assignments = await prisma.studentAdvisorAssignment.findMany({
      where: {
        studentId: parsed.data.studentId,
        isActive: true,
      },
      select: {
        advisorId: true,
      },
    });

    if (assignments.length > 0) {
      await prisma.alert.createMany({
        data: assignments.map((assignment) => ({
          recipientUserId: assignment.advisorId,
          actorUserId: userId,
          studentId: parsed.data.studentId,
          type: AlertType.BEHAVIOR_REPORTED,
          priority:
            parsed.data.severity === BehaviorSeverity.HIGH ? AlertPriority.HIGH : AlertPriority.MEDIUM,
          title: "มีการบันทึกพฤติกรรมผิดปกติจากอาจารย์ผู้สอน",
          message: `${parsed.data.category}: ${parsed.data.details}`,
          sourceType: "BehaviorRecord",
          sourceId: behaviorRecord.id,
        })),
      });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "instructor.behavior-record.create",
      entityType: "BehaviorRecord",
      entityId: behaviorRecord.id,
      description: "อาจารย์ผู้สอนบันทึกพฤติกรรมผิดปกติ",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "บันทึกพฤติกรรมและแจ้งอาจารย์ที่ปรึกษาแล้ว",
      behaviorRecord,
    });
  } catch (error) {
    console.error("Create behavior record error:", error);
    res.status(500).json({ message: "Failed to create behavior record" });
  }
};
