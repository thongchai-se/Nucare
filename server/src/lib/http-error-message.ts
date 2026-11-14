/** ข้อความ error เริ่มต้นเมื่อระบบล้มเหลวแบบไม่ระบุสาเหตุ */
export const FRIENDLY_INTERNAL_ERROR = "ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง";

/** ข้อความเมื่อ body / ไฟล์ใหญ่เกินที่รับได้ */
export const FRIENDLY_PAYLOAD_TOO_LARGE =
  "ไฟล์หรือข้อมูลที่ส่งมีขนาดใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 2 MB แล้วลองใหม่";

type BodyParserLikeError = {
  type?: string;
  status?: number;
  statusCode?: number;
  name?: string;
  message?: string;
};

/** ตรวจว่าเป็น error จาก body-parser เมื่อ payload ใหญ่เกิน limit */
export function isPayloadTooLargeError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const err = error as BodyParserLikeError;
  if (err.type === "entity.too.large") {
    return true;
  }
  if (err.name === "PayloadTooLargeError") {
    return true;
  }
  const status = err.status ?? err.statusCode;
  if (status === 413) {
    return true;
  }
  return typeof err.message === "string" && /request entity too large/i.test(err.message);
}

/**
 * แปลง error ที่ไม่ถูกจับใน route ให้เป็น { status, message } ภาษาคนอ่าน
 * ไม่เปิดเผย stack หรือศัพท์เทคนิคต่อผู้ใช้
 */
export function resolveUnhandledHttpError(error: unknown): { status: number; message: string } {
  if (isPayloadTooLargeError(error)) {
    return { status: 413, message: FRIENDLY_PAYLOAD_TOO_LARGE };
  }
  return { status: 500, message: FRIENDLY_INTERNAL_ERROR };
}
