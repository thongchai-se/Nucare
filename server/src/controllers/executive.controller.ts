import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { buildExecutiveDashboardStats } from "../lib/executive-analytics";
import {
  buildScreeningRoundComparison,
  type StudyYearComparisonFilter,
} from "../lib/executive-screening-comparison";
import { MAX_STUDY_YEAR, MIN_STUDY_YEAR } from "../lib/study-year";
import { hasAssignedRole } from "../lib/roles";

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
