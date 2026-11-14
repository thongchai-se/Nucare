import { Role } from "@prisma/client";
import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { canAccessStudent } from "../lib/access-control";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { formatAuditMetadata } from "../lib/audit-metadata";
import { prisma } from "../lib/prisma";
import { hasAssignedRole } from "../lib/roles";
import { buildStudentAssessmentTimeline } from "../lib/survey-assessment-history";

const assessmentHistoryParamsSchema = z
  .object({
    studentUserId: z.string().trim().min(1).max(128),
  })
  .strict();

const assessmentHistoryQuerySchema = z
  .object({
    instrumentCode: z.string().trim().min(1).max(128).optional(),
    from: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date").optional(),
    to: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date").optional(),
  })
  .strict()
  .refine(
    (value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to),
    { message: "from must be before or equal to to", path: ["to"] }
  );

const parseDateBoundary = (value: string | undefined, endOfDay: boolean): Date | undefined => {
  if (!value) {
    return undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  }
  return new Date(value);
};

/**
 * สร้าง controller ประวัติผลประเมินร่วมกันทุกบทบาท พร้อมตรวจบทบาท สิทธิ์รายนิสิต และช่วงวันที่
 * การอ่านสำเร็จจะบันทึก audit log โดยไม่ส่งข้อมูลอ่อนไหวลง log
 */
export function createAssessmentHistoryController(role: Role): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    const actorUserId = req.user?.userId;
    if (!actorUserId || !hasAssignedRole(req.user, role)) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const parsedParams = assessmentHistoryParamsSchema.safeParse(req.params);
    const parsedQuery = assessmentHistoryQuerySchema.safeParse(req.query);
    if (!parsedParams.success || !parsedQuery.success) {
      res.status(400).json({
        message: "Invalid assessment history request",
        errors: {
          params: parsedParams.success ? undefined : parsedParams.error.flatten(),
          query: parsedQuery.success ? undefined : parsedQuery.error.flatten(),
        },
      });
      return;
    }

    const studentUserId = parsedParams.data.studentUserId;

    try {
      const allowed = await canAccessStudent(role, actorUserId, studentUserId);
      if (!allowed) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }

      const student = await prisma.user.findFirst({
        where: { id: studentUserId, role: Role.STUDENT, isActive: true },
        select: { id: true },
      });
      if (!student) {
        res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
        return;
      }

      const timeline = await buildStudentAssessmentTimeline({
        studentId: student.id,
        instrumentCode: parsedQuery.data.instrumentCode,
        from: parseDateBoundary(parsedQuery.data.from, false),
        to: parseDateBoundary(parsedQuery.data.to, true),
      });

      await writeAuditLog({
        actorUserId,
        action: `${role.toLowerCase()}.assessment-history.view`,
        entityType: "User",
        entityId: student.id,
        description: formatAuditMetadata({ op: "view_assessment_history" }),
        ipAddress: getRequestIpAddress(req),
      });

      res.status(200).json({ timeline });
    } catch (error) {
      console.error("Get assessment history error:", error);
      res.status(500).json({ message: "Failed to fetch assessment history" });
    }
  };
}

export const getAdvisorAssessmentHistory = createAssessmentHistoryController(Role.ADVISOR);
export const getMentalHealthAssessmentHistory = createAssessmentHistoryController(Role.MENTAL_HEALTH);
export const getExecutiveAssessmentHistory = createAssessmentHistoryController(Role.EXECUTIVE);
