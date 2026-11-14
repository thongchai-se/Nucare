import { readEnv } from "./env";

/** ขั้นต่ำตามแนวทาง พ.ร.บ.คอมฯ (วัน) */
export const LOG_RETENTION_MIN_DAYS = 90;
/** สูงสุดที่เจ้าหน้าที่อาจสั่งเก็บเพิ่ม (วัน) */
export const LOG_RETENTION_MAX_DAYS = 730;

/**
 * อ่านจำนวนวันเก็บ log จาก env แล้วจำกัดให้อยู่ในช่วง 90–730 วัน
 */
export const resolveLogRetentionDays = (
  envName: string,
  fallback = LOG_RETENTION_MIN_DAYS
): number => {
  const raw = readEnv(envName);
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(LOG_RETENTION_MAX_DAYS, Math.max(LOG_RETENTION_MIN_DAYS, parsed));
};

/** คำนวณจุดตัดเวลาสำหรับลบ log ที่เก่าเกิน retention */
export const resolveLogRetentionCutoff = (retentionDays: number, now = new Date()): Date => {
  const days = Math.min(
    LOG_RETENTION_MAX_DAYS,
    Math.max(LOG_RETENTION_MIN_DAYS, Math.trunc(retentionDays))
  );
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
};
