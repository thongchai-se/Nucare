/**
 * จัดหมวดเหตุการณ์ความปลอดภัย (red flag) จาก AuditLog.action
 * — ใช้กรองแดชบอร์ดแอดมินและ popup รุนแรง
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

/** path ที่ถือว่าเป็นโซนแอดมิน/ผู้บริหาร — ใช้ตอน privilege probe */
export function isSensitiveAdminPath(path: string): boolean {
  const normalized = path.split("?")[0] || path;
  return (
    normalized.startsWith("/api/admin") ||
    normalized.startsWith("/api/executive") ||
    normalized === "/admin" ||
    normalized.startsWith("/admin/") ||
    normalized === "/executive" ||
    normalized.startsWith("/executive/")
  );
}

/** ตัด query/fragment ออกจาก path ก่อนเก็บ audit */
export function sanitizeAuditPath(path: string): string {
  const base = (path.split("?")[0] || path).split("#")[0] || "/";
  return base.slice(0, 200);
}

/**
 * throttle เขียน audit ในหน่วยความจำ — คืน true เมื่อควรเขียน
 * key เช่น `rate:login:1.2.3.4` หรือ `priv:userId:/api/admin`
 */
export function shouldWriteThrottledAudit(
  key: string,
  windowMs: number,
  nowMs: number = Date.now(),
  lastWrittenAtByKey: Map<string, number> = globalSecurityAuditThrottleMap
): boolean {
  const previous = lastWrittenAtByKey.get(key);
  if (previous != null && nowMs - previous < windowMs) {
    return false;
  }
  lastWrittenAtByKey.set(key, nowMs);
  return true;
}

/** แผนที่ throttle ร่วมทั้งโปรเซส (อย่าใช้ข้าม instance ในคลัสเตอร์) */
export const globalSecurityAuditThrottleMap = new Map<string, number>();

export const SECURITY_AUDIT_THROTTLE_MS = 60_000;
