import { RiskLevel } from "@prisma/client";

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

export const inferStudyYear = (studentId: string | null): string => {
  if (!studentId) {
    return "-";
  }

  const compact = studentId.replace(/\D/g, "");
  if (compact.length < 2) {
    return "-";
  }

  const admissionYearShort = Number.parseInt(compact.slice(0, 2), 10);
  if (!Number.isFinite(admissionYearShort)) {
    return "-";
  }

  const admissionYearBuddhist = 2500 + admissionYearShort;
  const currentYearBuddhist = new Date().getFullYear() + 543;
  const computedYear = currentYearBuddhist - admissionYearBuddhist + 1;

  if (!Number.isFinite(computedYear) || computedYear < 1) {
    return "-";
  }

  return `${Math.min(computedYear, 8)}`;
};

export const getUserInitials = (name: string, fallback = "NU"): string => {
  const parts = name
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
