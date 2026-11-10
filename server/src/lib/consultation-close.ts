/**
 * คำศัพท์และเหตุผลสำหรับปิด/ยกเลิกเคสปรึกษา
 * — ยกเลิก = นิสิตขอแล้วอาจารย์ยืนยัน (ป้ายเหลือง)
 * — ปิดเคสแล้ว = คุยจบจากนัดที่ยืนยัน (ป้ายเขียว)
 */

/** ป้ายเมื่อปิดหลังพูดคุยจบ */
export const CLOSED_CASE_LABEL = "ปิดเคสแล้ว";
/** ป้ายเมื่อยกเลิกคิว (หลังอาจารย์ยืนยัน) */
export const CANCELLED_CASE_LABEL = "ยกเลิก";
/** ป้ายขณะรอยืนยันจากอาจารย์ */
export const CANCEL_REQUESTED_LABEL = "นศขอยกเลิก";

/** marker ภายในระบบ — เก็บเหตุผลขอยกเลิกของนิสิต */
export const CANCEL_REQUEST_MARKER = "ขอยกเลิก";
export const CANCEL_REQUEST_PREFIX = `${CANCEL_REQUEST_MARKER} — `;

/** @deprecated ชื่อเก่า — ใช้ CANCEL_REQUEST_* */
export const MID_QUEUE_CLOSE_MARKER = CANCEL_REQUEST_MARKER;
/** @deprecated */
export const MID_QUEUE_CLOSE_PREFIX = CANCEL_REQUEST_PREFIX;
/** @deprecated */
export const MID_QUEUE_CLOSE_LABEL = CANCELLED_CASE_LABEL;
/** @deprecated */
export const COMPLETED_CLOSE_LABEL = CLOSED_CASE_LABEL;

/** เหตุผลที่นิสิตเลือกได้ตอนขอยกเลิกก่อนนัดยืนยัน */
export const STUDENT_CANCEL_REASONS = [
  "จัดการเรื่องได้แล้วในระดับหนึ่ง",
  "ตารางเวลาไม่สะดวกในช่วงนี้",
  "ต้องการเตรียมตัว / รวบรวมข้อมูลก่อนคุยใหม่",
  "ส่งคำขอผิดพลาด หรือยังไม่พร้อมคุย",
  "ได้พูดคุยหรือรับคำแนะนำจากช่องทางอื่นแล้ว",
  "ต้องการเปลี่ยนหัวข้อ หรือเลือกอาจารย์ใหม่",
  "ยังไม่สะดวกเปิดเผยรายละเอียดเพิ่มตอนนี้",
  "เหตุผลส่วนตัวอื่น ๆ",
] as const;

/** ค่าเหตุผล «อื่นๆ» ที่ต้องกรอกรายละเอียดเพิ่ม */
export const ADVISOR_CANCEL_REASON_OTHER = "อื่นๆ";

/** เหตุผลที่อาจารย์เลือกได้ตอนยกเลิกคิวเอง */
export const ADVISOR_CANCEL_REASONS = [
  "นิสิตติดต่อไม่ได้ / ไม่ตอบกลับ",
  "ตารางเวลาไม่ตรงกันในช่วงนี้",
  "นิสิตแจ้งว่าจัดการเรื่องได้แล้ว",
  "ส่งต่อทีมอื่นแล้ว / ไม่ต้องนัดต่อ",
  "คำขอซ้ำหรือส่งผิดพลาด",
  ADVISOR_CANCEL_REASON_OTHER,
] as const;

/** @deprecated ใช้ STUDENT_CANCEL_REASONS */
export const STUDENT_MID_QUEUE_CLOSE_REASONS = STUDENT_CANCEL_REASONS;

export type StudentCancelReason = (typeof STUDENT_CANCEL_REASONS)[number];
/** @deprecated */
export type StudentMidQueueCloseReason = StudentCancelReason;
export type AdvisorCancelReason = (typeof ADVISOR_CANCEL_REASONS)[number];

/** ตรวจว่าเป็นเหตุผลที่อนุญาตให้นิสิตเลือก */
export function isStudentCancelReason(value: string): value is StudentCancelReason {
  return (STUDENT_CANCEL_REASONS as readonly string[]).includes(value);
}

/** @deprecated */
export function isStudentMidQueueCloseReason(value: string): value is StudentCancelReason {
  return isStudentCancelReason(value);
}

/** ตรวจว่าเป็นเหตุผลที่อนุญาตให้อาจารย์เลือก */
export function isAdvisorCancelReason(value: string): value is AdvisorCancelReason {
  return (ADVISOR_CANCEL_REASONS as readonly string[]).includes(value);
}

/**
 * ตรวจเหตุผลยกเลิกของอาจารย์ — ถ้าเป็นอื่นๆ ต้องมีรายละเอียด
 * คืนข้อความ error หรือ null ถ้าผ่าน
 */
export function validateAdvisorCancelReasonInput(
  reason: string | undefined,
  detail?: string | null
): string | null {
  const trimmedReason = reason?.trim() || "";
  if (!trimmedReason || !isAdvisorCancelReason(trimmedReason)) {
    return "กรุณาเลือกเหตุผลการยกเลิก";
  }
  if (trimmedReason === ADVISOR_CANCEL_REASON_OTHER) {
    const extra = detail?.trim() || "";
    if (extra.length < 3) {
      return "กรุณาระบุรายละเอียดเพิ่มเติมเมื่อเลือกอื่นๆ";
    }
    if (extra.length > 500) {
      return "รายละเอียดเพิ่มเติมยาวเกินไป";
    }
  }
  return null;
}

/** จัดรูปหมายเหตุตอนนิสิตขอยกเลิก */
export function formatStudentCancelRequestNote(reason: StudentCancelReason): string {
  return `${CANCEL_REQUEST_PREFIX}${reason}`;
}

/** จัดรูปหมายเหตุตอนอาจารย์ยกเลิกคิวเอง */
export function formatAdvisorDirectCancelNote(
  reason: AdvisorCancelReason,
  detail?: string | null
): string {
  if (reason === ADVISOR_CANCEL_REASON_OTHER) {
    const extra = detail?.trim() || "";
    return `${CANCEL_REQUEST_PREFIX}อาจารย์ยกเลิก — ${reason}: ${extra}`;
  }
  return `${CANCEL_REQUEST_PREFIX}อาจารย์ยกเลิก — ${reason}`;
}

/** @deprecated */
export function formatStudentMidQueueCloseNote(reason: StudentCancelReason): string {
  return formatStudentCancelRequestNote(reason);
}

/** จัดรูปหมายเหตุตอนอาจารย์ยืนยันยกเลิก (เก็บเหตุผลนิสิตไว้) */
export function formatAdvisorConfirmCancelNote(
  existingNote?: string | null,
  advisorNote?: string | null
): string {
  const existing = existingNote?.trim() || CANCEL_REQUEST_MARKER;
  const extra = advisorNote?.trim() || "";
  if (!extra) {
    return existing.startsWith(CANCEL_REQUEST_PREFIX) || existing === CANCEL_REQUEST_MARKER
      ? existing
      : `${CANCEL_REQUEST_PREFIX}${existing}`;
  }
  return `${existing} · อาจารย์รับทราบ: ${extra}`;
}

/** @deprecated — อาจารย์ไม่ปิดกลางทางเองแล้ว */
export function formatAdvisorMidQueueCloseNote(note?: string | null): string {
  const trimmed = note?.trim() || "";
  if (!trimmed) {
    return CANCEL_REQUEST_MARKER;
  }
  if (trimmed.startsWith(CANCEL_REQUEST_PREFIX) || trimmed === CANCEL_REQUEST_MARKER) {
    return trimmed;
  }
  return `${CANCEL_REQUEST_PREFIX}${trimmed}`;
}

/** หมายเหตุนี้บ่งว่าเป็นคำขอยกเลิก/ยกเลิกแล้วหรือไม่ */
export function isCancelRequestNote(note?: string | null): boolean {
  const trimmed = note?.trim() || "";
  return trimmed === CANCEL_REQUEST_MARKER || trimmed.startsWith(CANCEL_REQUEST_PREFIX);
}

/** @deprecated */
export function isMidQueueCloseNote(note?: string | null): boolean {
  return isCancelRequestNote(note);
}

/**
 * ป้ายสถานะจบเคสที่แสดงผู้ใช้
 * — CANCELLED / หมายเหตุยกเลิกรุ่นเก่า → ยกเลิก
 * — CLOSED ปกติ → ปิดเคสแล้ว
 */
export function consultationClosedStatusLabel(
  statusOrNote?: string | null,
  advisorNote?: string | null
): string {
  // รองรับเรียกแบบเก่า (note อย่างเดียว) และแบบใหม่ (status, note)
  if (statusOrNote === "CANCELLED") {
    return CANCELLED_CASE_LABEL;
  }
  if (statusOrNote === "CLOSED") {
    return isCancelRequestNote(advisorNote) ? CANCELLED_CASE_LABEL : CLOSED_CASE_LABEL;
  }
  if (statusOrNote === "CANCEL_REQUESTED") {
    return CANCEL_REQUESTED_LABEL;
  }
  // เรียกแบบเก่า: argument แรกเป็น advisorNote
  return isCancelRequestNote(statusOrNote) ? CANCELLED_CASE_LABEL : CLOSED_CASE_LABEL;
}

/**
 * โทนสีป้ายจบเคส — cancelled = เหลือง, done = เขียว
 * รองรับทั้ง status และหมายเหตุรุ่นเก่า
 */
export function consultationClosedTone(
  statusOrNote?: string | null,
  advisorNote?: string | null
): "cancelled" | "done" {
  if (statusOrNote === "CANCELLED") {
    return "cancelled";
  }
  if (statusOrNote === "CLOSED") {
    return isCancelRequestNote(advisorNote) ? "cancelled" : "done";
  }
  if (statusOrNote === "CANCEL_REQUESTED") {
    return "cancelled";
  }
  return isCancelRequestNote(statusOrNote) ? "cancelled" : "done";
}

/** @deprecated alias — mid = cancelled */
export type ConsultationCloseTone = "cancelled" | "done" | "mid";
