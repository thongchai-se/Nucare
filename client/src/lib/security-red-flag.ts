/**
 * จัดหมวดเหตุการณ์ความปลอดภัย (red flag) จาก AuditLog.action
 * — ให้ตรงกับ server/src/lib/security-red-flag.ts
 */

export type SecurityRedFlagSeverity = "CRITICAL" | "HIGH" | "MEDIUM";

const CRITICAL_ACTIONS = new Set([
  "auth.refresh.reuse-detected",
  "security.privilege-probe",
]);

const HIGH_ACTIONS = new Set(["security.rate-limit", "security.authz-denied"]);

const MEDIUM_ACTIONS = new Set(["auth.login.failed"]);

const ALL_RED_FLAG_ACTIONS = new Set([
  ...CRITICAL_ACTIONS,
  ...HIGH_ACTIONS,
  ...MEDIUM_ACTIONS,
]);

/** ตรวจว่า action เป็น red flag ความปลอดภัยหรือไม่ */
export function isSecurityRedFlagAction(action: string): boolean {
  return ALL_RED_FLAG_ACTIONS.has(action.trim());
}

/** ระดับความรุนแรงของ red flag — ไม่ใช่ red flag คืน null */
export function getSecurityRedFlagSeverity(
  action: string
): SecurityRedFlagSeverity | null {
  const key = action.trim();
  if (CRITICAL_ACTIONS.has(key)) {
    return "CRITICAL";
  }
  if (HIGH_ACTIONS.has(key)) {
    return "HIGH";
  }
  if (MEDIUM_ACTIONS.has(key)) {
    return "MEDIUM";
  }
  return null;
}

/** CRITICAL เท่านั้น — ใช้เปิด popup ตอนเข้าแอดมิน */
export function isCriticalSecurityRedFlag(action: string): boolean {
  return getSecurityRedFlagSeverity(action) === "CRITICAL";
}

export const SECURITY_CRITICAL_ACK_STORAGE_KEY = "nucare.admin.securityCriticalAck";
export const SECURITY_CRITICAL_WINDOW_MS = 24 * 60 * 60 * 1000;
