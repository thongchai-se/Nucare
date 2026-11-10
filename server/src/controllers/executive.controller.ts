import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { buildExecutiveDashboardStats } from "../lib/executive-analytics";
import {
  buildScreeningRoundComparison,
  type StudyYearComparisonFilter,
} from "../lib/executive-screening-comparison";
import { prisma } from "../lib/prisma";
import { getExecutiveStudentDossier } from "../lib/executive-student-dossier";
import { listSensitiveStudentCards } from "../lib/sensitive-student-detail";
import { MAX_STUDY_YEAR, MIN_STUDY_YEAR } from "../lib/study-year";
import { hasAssignedRole } from "../lib/roles";

const listStudentsQuerySchema = z.object({
  /** ค้นหาไม่บังคับ — ว่าง = รายชื่อในขอบเขตสิทธิ์ (จำกัดจำนวนฝั่ง lib) */
  search: z.string().trim().min(2).max(120).optional(),
});

const studentParamSchema = z.object({
  studentUserId: z.string().trim().min(1),
});

const parseStudyYearFilter = (raw: unknown): StudyYearComparisonFilter => {
  if (raw === undefined || raw === null || raw === "ALL" || raw === "") {
    return "ALL";
  }

  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < MIN_STUDY_YEAR || parsed > MAX_STUDY_YEAR) {
    return "ALL";
  }

  return parsed;
};

export const getExecutiveDashboard = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const payload = await buildExecutiveDashboardStats();
    res.status(200).json(payload);
  } catch (error) {
    console.error("Get executive dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch executive dashboard" });
  }
};

export const getExecutiveScreeningComparison = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const fromSurveyId =
      typeof req.query.fromSurveyId === "string" && req.query.fromSurveyId.trim().length > 0
        ? req.query.fromSurveyId.trim()
        : undefined;
    const toSurveyId =
      typeof req.query.toSurveyId === "string" && req.query.toSurveyId.trim().length > 0
        ? req.query.toSurveyId.trim()
        : undefined;

    const payload = await buildScreeningRoundComparison({
      fromSurveyId,
      toSurveyId,
      studyYear: parseStudyYearFilter(req.query.studyYear),
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error("Get executive screening comparison error:", error);
    res.status(500).json({ message: "Failed to fetch screening comparison" });
  }
};

/** รายการนิสิตพร้อมผลละเอียดอ่อน — ผู้บริหารเห็นได้ทั้งคณะ */
export const listExecutiveStudents = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedQuery = listStudentsQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ message: "Invalid query", errors: parsedQuery.error.flatten() });
    return;
  }

  try {
    const students = await listSensitiveStudentCards(
      prisma,
      Role.EXECUTIVE,
      userId,
      parsedQuery.data.search
    );
    res.status(200).json({ students, total: students.length });
  } catch (error) {
    console.error("List executive students error:", error);
    res.status(500).json({ message: "Failed to list students" });
  }
};

/** รายละเอียดนิสิตรายคน + dossier แนวโน้มปรึกษา/ส่งต่อ/SOS สำหรับผู้บริหาร */
export const getExecutiveStudentDetail = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = studentParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "Invalid student id", errors: parsedParams.error.flatten() });
    return;
  }

  try {
    const result = await getExecutiveStudentDossier(
      prisma,
      userId,
      parsedParams.data.studentUserId
    );
    if (result === "forbidden") {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (result === "not_found") {
      res.status(404).json({ message: "ไม่พบข้อมูลนักศึกษา" });
      return;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "executive.student-detail.view",
      entityType: "User",
      entityId: result.student.id,
      description: "ผู้บริหารเปิดดูรายละเอียดละเอียดอ่อนของนักศึกษา",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Get executive student detail error:", error);
    res.status(500).json({ message: "Failed to fetch student detail" });
  }
};
