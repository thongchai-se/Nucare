import { AlertPriority, AlertType, BehaviorSeverity, Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { canAccessStudent, getStudentScopeWhere } from "../lib/access-control";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { formatAuditMetadata } from "../lib/audit-metadata";
import { listReporterObservations } from "../lib/behavior-observation";
import { prisma } from "../lib/prisma";
import { formatStudentIdForResponse } from "../lib/user-format";

const listStudentsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

const INSTRUCTOR_STUDENT_LIST_MAX_RESULTS = 1000;

const createBehaviorRecordSchema = z.object({
  studentId: z.string().trim().min(1),
  observedAt: z.string().trim().min(1),
  category: z.string().trim().min(1).max(120),
  details: z.string().trim().min(1).max(4000),
  severity: z.nativeEnum(BehaviorSeverity),
});

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
      take: INSTRUCTOR_STUDENT_LIST_MAX_RESULTS,
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

/** ประวัติข้อสังเกตที่ผู้สอนเป็นผู้แจ้ง — รวมเส้นทางรับเรื่อง/ปิด/ส่งต่อให้ผู้แจ้งติดตามได้ */
export const listBehaviorRecords = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const roles = req.user?.roles ?? (req.user?.role ? [req.user.role] : []);
  if (!userId || !roles.includes(Role.INSTRUCTOR)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const records = await listReporterObservations(userId);
    res.status(200).json({ records });
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
          title: "ผู้สอนแจ้งข้อสังเกตแนวโน้มของนิสิต",
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
      description: formatAuditMetadata({ op: "behavior_record" }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "บันทึกข้อสังเกตและแจ้งอาจารย์ที่ปรึกษาแล้ว",
      behaviorRecord,
    });
  } catch (error) {
    console.error("Create behavior record error:", error);
    res.status(500).json({ message: "Failed to create behavior record" });
  }
};
