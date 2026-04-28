import { AlertPriority, AlertType, BehaviorSeverity, Role } from "@prisma/client";
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

export const listInstructorStudents = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const role = req.user?.role;
  if (!userId || role !== Role.INSTRUCTOR) {
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
    const where = await getStudentScopeWhere(role, userId);
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

export const createBehaviorRecord = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const role = req.user?.role;
  if (!userId || role !== Role.INSTRUCTOR) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createBehaviorRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const canAccess = await canAccessStudent(role, userId, parsed.data.studentId);
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
