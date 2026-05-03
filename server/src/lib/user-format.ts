import { RiskLevel } from "@prisma/client";
import { stripKnownNamePrefix } from "./name-prefix";

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
    return `${Math.min(Math.trunc(explicitStudyYear), 8)}`;
  }

  return "-";
};

export const getUserInitials = (name: string, fallback = "NU"): string => {
  const parts = stripKnownNamePrefix(name)
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-zก-๙]/g, ""))
    .filter(Boolean);

  if (parts.length === 0) {
    return fallback;
  }

  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";

  return `${first}${second}`.toUpperCase();
};

export const normalizeRiskLevel = (riskLevel: RiskLevel): "high" | "medium" | "normal" => {
  if (riskLevel === RiskLevel.HIGH) {
    return "high";
  }

  if (riskLevel === RiskLevel.MEDIUM) {
    return "medium";
  }

  return "normal";
};
