import { RiskLevel } from "@prisma/client";
import { getNameInitials } from "./name-prefix";
import { clampStudyYear } from "./study-year";

const STUDENT_ID_PATTERN = /^\d{9}-\d$/;

export const formatStudentIdForResponse = (studentId: string | null): string | null => {
  if (!studentId) {
    return null;
  }

  if (STUDENT_ID_PATTERN.test(studentId)) {
    return studentId;
  }

  if (/^\d{10}$/.test(studentId)) {
    return `${studentId.slice(0, 9)}-${studentId.slice(9)}`;
  }

  return studentId;
};

export const inferStudyYear = (
  _studentId: string | null,
  explicitStudyYear?: number | null
): string => {
  if (
    typeof explicitStudyYear === "number" &&
    Number.isFinite(explicitStudyYear) &&
    explicitStudyYear >= 1
  ) {
    return `${clampStudyYear(explicitStudyYear)}`;
  }

  return "-";
};

export const getUserInitials = (name: string, fallback = "NU"): string => getNameInitials(name, fallback);

export const normalizeRiskLevel = (riskLevel: RiskLevel): "high" | "medium" | "normal" => {
  if (riskLevel === RiskLevel.HIGH) {
    return "high";
  }

  if (riskLevel === RiskLevel.MEDIUM) {
    return "medium";
  }

  return "normal";
};
