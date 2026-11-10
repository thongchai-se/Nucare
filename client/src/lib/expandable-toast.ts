export type ExpandableToastTone = "success" | "info" | "error" | "warning";

/** ระยะแสดง toast มาตรฐานตามแบบ Expandable Notification (15 วินาที) */
export const EXPANDABLE_TOAST_DURATION_MS = 15_000;

/** แปลงเวลาที่เหลือเป็นวินาทีสำหรับข้อความนับถอยหลัง */
export function formatToastCountdownSeconds(remainingMs: number): number {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

/** สัดส่วนแถบเวลาที่เดินไปแล้ว (0–1) — เต็มแล้วถึงเวลาปิด */
export function computeToastElapsedProgress(remainingMs: number, totalMs: number): number {
  if (!Number.isFinite(totalMs) || totalMs <= 0) {
    return 1;
  }
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 1;
  }
  const elapsed = totalMs - remainingMs;
  return Math.min(1, Math.max(0, elapsed / totalMs));
}

/** ข้อความซ้ายของ footer (ภาษาไทย) */
export function buildToastTimerLeftLabel(remainingSeconds: number): string {
  if (remainingSeconds <= 0) {
    return "กำลังปิดข้อความ…";
  }
  return `ข้อความนี้จะปิดใน ${remainingSeconds} วินาที`;
}

/**
 * จัดหัวข้อ/รายละเอียด toast — ไม่เติมคำอธิบายสำรอง
 * และปิดแผงรายละเอียดเป็นค่าเริ่มต้น (อยากดูให้กดขยาย)
 */
export function resolveExpandableToastContent(input: {
  title: string;
  description?: string | null;
  tone?: ExpandableToastTone;
}): {
  title: string;
  description: string;
  tone: ExpandableToastTone;
  expandByDefault: boolean;
  hasDetail: boolean;
} {
  const tone = input.tone || "info";
  const title = input.title.trim() || "การแจ้งเตือน";
  const rawDescription = input.description?.trim() || "";
  // ไม่โชว์ body ซ้ำถ้าเหมือนหัวข้อเป๊ะ
  const description = rawDescription && rawDescription !== title ? rawDescription : "";
  return {
    title,
    description,
    tone,
    expandByDefault: false,
    hasDetail: description.length > 0,
  };
}

/**
 * แปลงข้อความผลลัพธ์เป็นหัวข้อ toast — ใช้ข้อความการกระทำเป็นหัวข้อโดยตรง
 * ไม่ห่อด้วยคำกลาง ๆ อย่าง «อัปเดตข้อมูลแล้ว» / «มีข้อมูลอัปเดต»
 */
export function resolveActionToastPresentation(input: {
  message: string;
  tone?: ExpandableToastTone;
  errorTitle?: string;
}): {
  title: string;
  description?: string;
  tone: ExpandableToastTone;
} {
  const tone = input.tone || "success";
  const message = input.message.trim();

  if (tone === "error") {
    return {
      title: (input.errorTitle || "ดำเนินการไม่สำเร็จ").trim(),
      ...(message ? { description: message } : {}),
      tone,
    };
  }

  return {
    title: message || "ดำเนินการสำเร็จ",
    tone,
  };
}

/** ข้อความ toast ตามสถานะคำขอปรึกษาที่เพิ่งเปลี่ยน */
export function consultationStatusToastMessage(status: string): string {
  switch (status) {
    case "ACCEPTED":
      return "รับคำขอปรึกษาแล้ว";
    case "SCHEDULED":
      return "ยืนยันนัดหมายแล้ว";
    case "CLOSED":
      return "ปิดเคสปรึกษาแล้ว";
    case "CANCELLED":
      return "ยกเลิกคำขอปรึกษาแล้ว";
    case "CANCEL_REQUESTED":
      return "บันทึกคำขอยกเลิกจากนิสิตแล้ว";
    case "PENDING":
      return "ส่งคำขอปรึกษาแล้ว";
    default:
      return "บันทึกคำขอปรึกษาแล้ว";
  }
}

/**
 * สี toast ตามสถานะคำขอปรึกษา
 * สำเร็จ=เขียว · ยกเลิก/ขอยกเลิก=ส้มเตือน · อื่น ๆ ที่ไม่ใช่ error=เขียว
 */
export function consultationStatusToastTone(status: string): ExpandableToastTone {
  if (status === "CANCELLED" || status === "CANCEL_REQUESTED") {
    return "warning";
  }
  return "success";
}
