/**
 * สถานะแสดงผลบันทึกระบบ — รวมผลดำเนินการปกติกับระดับความปลอดภัย
 * — สอดคล้องกับ server/src/lib/audit-status.ts
 */

import { getSecurityRedFlagSeverity } from "./security-red-flag";

export type AuditDisplayStatus =
  | "Success"
  | "Partial"
  | "Failed"
  | "Critical"
  | "High"
  | "Watch";

export const AUDIT_DISPLAY_STATUS_FILTER_OPTIONS: Array<{
  value: AuditDisplayStatus;
  label: string;
}> = [
  { value: "Success", label: "สำเร็จ" },
  { value: "Partial", label: "สำเร็จบางส่วน" },
  { value: "Failed", label: "ไม่สำเร็จ" },
  { value: "Watch", label: "เฝ้าระวัง" },
  { value: "High", label: "สูง" },
  { value: "Critical", label: "วิกฤต" },
];

type AuditStatusInput = {
  action: string;
  description?: string | null;
};

const parseMetric = (description: string, key: string): number | null => {
  const match = new RegExp(`${key}=(\\d+)`, "i").exec(description);
  if (!match) {
    return null;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseText = (description: string, key: string): string | null => {
  const match = new RegExp(`${key}=([^|\\s]+)`, "i").exec(description);
  return match?.[1]?.trim() || null;
};

/** แปลงผลนำเข้า (import) จาก description เป็นสถานะดำเนินการ */
function resolveImportDisplayStatus(description: string | null | undefined): AuditDisplayStatus | null {
  if (!description) {
    return null;
  }

  const outcome = parseText(description, "outcome");
  if (outcome === "success") {
    return "Success";
  }
  if (outcome === "partial") {
    return "Partial";
  }
  if (outcome === "failed") {
    return "Failed";
  }

  const created = parseMetric(description, "created") ?? 0;
  const updated = parseMetric(description, "updated") ?? 0;
  const skipped = parseMetric(description, "skipped") ?? 0;
  const failed = parseMetric(description, "failed");

  if (failed === null && created === 0 && updated === 0 && skipped === 0) {
    return null;
  }

  const failedCount = failed ?? 0;
  const completedCount = created + updated + skipped;

  if (failedCount > 0 && completedCount > 0) {
    return "Partial";
  }
  if (failedCount > 0) {
    return "Failed";
  }
  return "Success";
}

/** คืนสถานะแสดงผล: เหตุความปลอดภัยแยก วิกฤต/สูง/เฝ้าระวัง — อื่น ๆ เป็นสำเร็จ/บางส่วน/ไม่สำเร็จ */
export function resolveAuditDisplayStatus(input: AuditStatusInput): AuditDisplayStatus {
  const severity = getSecurityRedFlagSeverity(input.action);
  if (severity === "CRITICAL") {
    return "Critical";
  }
  if (severity === "HIGH") {
    return "High";
  }
  if (severity === "MEDIUM") {
    return "Watch";
  }

  if (input.action.endsWith(".import")) {
    const fromImport = resolveImportDisplayStatus(input.description);
    if (fromImport) {
      return fromImport;
    }
  }

  const haystack = `${input.action} ${input.description || ""}`.toLowerCase();
  return haystack.includes("failed") || haystack.includes("error") ? "Failed" : "Success";
}

/** ป้ายภาษาไทยของสถานะบันทึกระบบ */
export function getAuditDisplayStatusLabel(status: AuditDisplayStatus): string {
  switch (status) {
    case "Success":
      return "สำเร็จ";
    case "Partial":
      return "สำเร็จบางส่วน";
    case "Failed":
      return "ไม่สำเร็จ";
    case "Critical":
      return "วิกฤต";
    case "High":
      return "สูง";
    case "Watch":
      return "เฝ้าระวัง";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** คลาสสี badge สถานะ (Tailwind) */
export function getAuditDisplayStatusClassName(status: AuditDisplayStatus): string {
  switch (status) {
    case "Success":
      return "bg-emerald-100 text-emerald-700";
    case "Partial":
      return "bg-amber-100 text-amber-700";
    case "Failed":
      return "bg-red-100 text-red-700";
    case "Critical":
      return "bg-red-100 text-red-800";
    case "High":
      return "bg-amber-100 text-amber-900";
    case "Watch":
      return "bg-orange-100 text-orange-800";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
