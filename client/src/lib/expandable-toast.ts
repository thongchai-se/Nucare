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

const TOAST_TITLE_SEPARATORS = [" — ", " – ", " - ", " · "] as const;

/** แยกหัวข้อสั้นกับรายละเอียดถ้าข้อความยาวมีตัวคั่น */
export function splitToastTitleAndDetail(message: string): {
  title: string;
  description?: string;
} {
  const trimmed = message.trim();
  if (!trimmed) {
    return { title: "ดำเนินการสำเร็จ" };
  }

  for (const separator of TOAST_TITLE_SEPARATORS) {
    const index = trimmed.indexOf(separator);
    if (index <= 0) {
      continue;
    }
    const title = trimmed.slice(0, index).trim();
    const description = trimmed.slice(index + separator.length).trim();
    if (title && description) {
      return { title, description };
    }
  }

  // หัวข้อยาวเกิน ~28 ตัวอักษรโดยไม่มีตัวคั่น — ตัดที่ช่องว่างใกล้ ๆ
  if (trimmed.length > 28) {
    const slice = trimmed.slice(0, 28);
    const breakAt = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("·"));
    if (breakAt >= 12) {
      return {
        title: trimmed.slice(0, breakAt).trim(),
        description: trimmed.slice(breakAt).trim(),
      };
    }
  }

  return { title: trimmed };
}

/**
 * แปลงข้อความผลลัพธ์เป็นหัวข้อ toast สั้น ๆ — รายละเอียดยาวไปไว้ใต้หัวข้อให้กดขยาย
 */
export function resolveActionToastPresentation(input: {
  message: string;
  tone?: ExpandableToastTone;
  errorTitle?: string;
  title?: string;
  description?: string;
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

  if (input.title?.trim()) {
    const title = input.title.trim();
    const description = input.description?.trim();
    return {
      title,
      ...(description && description !== title ? { description } : {}),
      tone,
    };
  }

  const split = splitToastTitleAndDetail(message || "ดำเนินการสำเร็จ");
  return {
    title: split.title,
    ...(split.description ? { description: split.description } : {}),
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
      return "รับคำขอยกเลิกจากนิสิตแล้ว";
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
