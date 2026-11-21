import { ReferralStatus, ReferralTarget, Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { formatAuditMetadata } from "../lib/audit-metadata";
import { buildExecutiveDashboardStats } from "../lib/executive-analytics";
import {
  getExecutiveReferralCaseDetail,
  listExecutiveReferralCases,
  parseExecutiveReferralStudyYear,
} from "../lib/executive-referral-cases";
import {
  buildScreeningRoundComparison,
  type StudyYearComparisonFilter,
} from "../lib/executive-screening-comparison";
import { buildExecutiveScreeningOverview } from "../lib/executive-screening-overview";
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

const screeningComparisonQuerySchema = z
  .object({
    fromSurveyId: z.string().trim().min(1).max(128).optional(),
    toSurveyId: z.string().trim().min(1).max(128).optional(),
    studyYear: z.union([z.literal("ALL"), z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR)]).optional(),
    instrumentCode: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

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

  const parsedQuery = screeningComparisonQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ message: "Invalid query", errors: parsedQuery.error.flatten() });
    return;
  }

  try {
    const payload = await buildScreeningRoundComparison({
      fromSurveyId: parsedQuery.data.fromSurveyId,
      toSurveyId: parsedQuery.data.toSurveyId,
      studyYear: parseStudyYearFilter(parsedQuery.data.studyYear),
      instrumentCode: parsedQuery.data.instrumentCode,
    });

    res.status(200).json(payload);
  } catch (error) {
    console.error("Get executive screening comparison error:", error);
    res.status(500).json({ message: "Failed to fetch screening comparison" });
  }
};

const screeningOverviewQuerySchema = z
  .object({
    studyYear: z.union([z.literal("ALL"), z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR)]).optional(),
    instrumentCode: z.string().trim().min(1).max(128).optional(),
  })
  .strict();

/** สรุปคะแนน/อัตราทำแบบ/เสี่ยงสูงรายรอบ สำหรับกราฟเส้นภาพรวม */
export const getExecutiveScreeningOverview = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedQuery = screeningOverviewQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ message: "Invalid query", errors: parsedQuery.error.flatten() });
    return;
  }

  try {
    const payload = await buildExecutiveScreeningOverview({
      studyYear: parseStudyYearFilter(parsedQuery.data.studyYear),
      instrumentCode: parsedQuery.data.instrumentCode,
    });
    res.status(200).json(payload);
  } catch (error) {
    console.error("Get executive screening overview error:", error);
    res.status(500).json({ message: "Failed to fetch screening overview" });
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

const referralListQuerySchema = z
  .object({
    studyYear: z.union([z.literal("ALL"), z.coerce.number().int().min(MIN_STUDY_YEAR).max(MAX_STUDY_YEAR)]).optional(),
    status: z.nativeEnum(ReferralStatus).optional(),
    target: z.nativeEnum(ReferralTarget).optional(),
    urgentOnly: z
      .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
      .optional(),
    search: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

const referralParamSchema = z.object({
  referralId: z.string().trim().min(1).max(128),
});

/** รายการเคสส่งต่อทั้งคณะสำหรับผู้บริหาร (อ่านอย่างเดียว) */
export const listExecutiveReferrals = async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedQuery = referralListQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ message: "พารามิเตอร์ไม่ถูกต้อง", errors: parsedQuery.error.flatten() });
    return;
  }

  try {
    const urgentRaw = parsedQuery.data.urgentOnly;
    const payload = await listExecutiveReferralCases(prisma, {
      studyYear: parseExecutiveReferralStudyYear(parsedQuery.data.studyYear),
      status: parsedQuery.data.status,
      target: parsedQuery.data.target,
      urgentOnly: urgentRaw === "1" || urgentRaw === "true",
      search: parsedQuery.data.search,
    });
    res.status(200).json(payload);
  } catch (error) {
    console.error("List executive referrals error:", error);
    res.status(500).json({ message: "โหลดเคสส่งต่อไม่สำเร็จ กรุณาลองใหม่" });
  }
};

/** เจาะลึกเคสส่งต่อ: ผู้ส่ง ปลายทาง ผู้รับ บันทึก และเส้นทางสถานะ */
export const getExecutiveReferralDetail = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || !hasAssignedRole(req.user, Role.EXECUTIVE)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsedParams = referralParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    res.status(400).json({ message: "รายการส่งต่อไม่ถูกต้อง" });
    return;
  }

  try {
    const result = await getExecutiveReferralCaseDetail(prisma, parsedParams.data.referralId);
    if (result === "not_found") {
      res.status(404).json({ message: "ไม่พบรายการส่งต่อ" });
      return;
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "executive.referral-detail.view",
      entityType: "CaseReferral",
      entityId: parsedParams.data.referralId,
      description: formatAuditMetadata({ op: "view_referral_history" }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Get executive referral detail error:", error);
    res.status(500).json({ message: "โหลดรายละเอียดเคสส่งต่อไม่สำเร็จ กรุณาลองใหม่" });
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
      description: formatAuditMetadata({ op: "view_sensitive_detail" }),
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Get executive student detail error:", error);
    res.status(500).json({ message: "Failed to fetch student detail" });
  }
};
