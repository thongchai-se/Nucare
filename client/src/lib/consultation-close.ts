/**
 * คำศัพท์และเหตุผลสำหรับปิด/ยกเลิกเคสปรึกษา (ฝั่ง client)
 * — ต้องสอดคล้องกับ server/src/lib/consultation-close.ts
 */

/** ป้ายเมื่อปิดหลังพูดคุยจบ */
export const CLOSED_CASE_LABEL = "ปิดเคสแล้ว";
/** ป้ายเมื่อยกเลิกคิว (หลังอาจารย์ยืนยัน) */
export const CANCELLED_CASE_LABEL = "ยกเลิก";
/** ป้ายขณะรอยืนยันจากอาจารย์ */
export const CANCEL_REQUESTED_LABEL = "นศขอยกเลิก";

/** marker ภายในระบบ */
export const CANCEL_REQUEST_MARKER = "ขอยกเลิก";
export const CANCEL_REQUEST_PREFIX = `${CANCEL_REQUEST_MARKER} — `;

/** @deprecated */
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

/** @deprecated */
export const STUDENT_MID_QUEUE_CLOSE_REASONS = STUDENT_CANCEL_REASONS;

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

export type StudentCancelReason = (typeof STUDENT_CANCEL_REASONS)[number];
/** @deprecated */
export type StudentMidQueueCloseReason = StudentCancelReason;
export type AdvisorCancelReason = (typeof ADVISOR_CANCEL_REASONS)[number];

/** ตรวจว่าเป็นเหตุผลที่อนุญาตให้นิสิตเลือก */
export function isStudentCancelReason(value: string): value is StudentCancelReason {
  return (STUDENT_CANCEL_REASONS as readonly string[]).includes(value);
}

/** ตรวจว่าเป็นเหตุผลที่อนุญาตให้อาจารย์เลือก */
export function isAdvisorCancelReason(value: string): value is AdvisorCancelReason {
  return (ADVISOR_CANCEL_REASONS as readonly string[]).includes(value);
}

/** @deprecated */
export function isStudentMidQueueCloseReason(value: string): value is StudentCancelReason {
  return isStudentCancelReason(value);
}

/** หมายเหตุนี้บ่งว่าเป็นคำขอยกเลิกหรือไม่ */
export function isCancelRequestNote(note?: string | null): boolean {
  const trimmed = note?.trim() || "";
  return trimmed === CANCEL_REQUEST_MARKER || trimmed.startsWith(CANCEL_REQUEST_PREFIX);
}

/** @deprecated */
export function isMidQueueCloseNote(note?: string | null): boolean {
  return isCancelRequestNote(note);
}

/** ป้ายสถานะจบ/ยกเลิกที่แสดงผู้ใช้ */
export function consultationClosedStatusLabel(
  statusOrNote?: string | null,
  advisorNote?: string | null
): string {
  if (statusOrNote === "CANCELLED") {
    return CANCELLED_CASE_LABEL;
  }
  if (statusOrNote === "CANCEL_REQUESTED") {
    return CANCEL_REQUESTED_LABEL;
  }
  if (statusOrNote === "CLOSED") {
    return isCancelRequestNote(advisorNote) ? CANCELLED_CASE_LABEL : CLOSED_CASE_LABEL;
  }
  return isCancelRequestNote(statusOrNote) ? CANCELLED_CASE_LABEL : CLOSED_CASE_LABEL;
}

/** โทนสี — cancelled = เหลือง, done = เขียว */
export function consultationClosedTone(
  statusOrNote?: string | null,
  advisorNote?: string | null
): "cancelled" | "done" {
  if (statusOrNote === "CANCELLED" || statusOrNote === "CANCEL_REQUESTED") {
    return "cancelled";
  }
  if (statusOrNote === "CLOSED") {
    return isCancelRequestNote(advisorNote) ? "cancelled" : "done";
  }
  return isCancelRequestNote(statusOrNote) ? "cancelled" : "done";
}

/** คลาสป้ายตามโทน */
export function consultationClosedBadgeClassName(
  statusOrNote?: string | null,
  advisorNote?: string | null
): string {
  return consultationClosedTone(statusOrNote, advisorNote) === "cancelled"
    ? "bg-amber-100 text-amber-800"
    : "bg-emerald-100 text-emerald-800";
}

/** ข้อความหมายเหตุการยกเลิก/ปิดที่แสดงนิสิต */
export function presentCloseNoteForStudent(note?: string | null): string | null {
  const trimmed = note?.trim() || "";
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith(CANCEL_REQUEST_PREFIX)) {
    return trimmed.slice(CANCEL_REQUEST_PREFIX.length).trim() || CANCELLED_CASE_LABEL;
  }
  if (trimmed === CANCEL_REQUEST_MARKER) {
    return CANCELLED_CASE_LABEL;
  }
  return trimmed;
}
