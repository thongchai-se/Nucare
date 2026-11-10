import { ReferralStatus, ReferralTarget } from "@prisma/client";

export const ACTIVE_REFERRAL_STATUSES: ReferralStatus[] = [
  ReferralStatus.PENDING,
  ReferralStatus.ACCEPTED,
];

/** เคสส่งต่อที่ยังเปิดอยู่ (รอรับหรือกำลังดูแล) — ห้ามสร้างซ้ำใน target เดียวกัน */
export function isActiveReferralStatus(status: ReferralStatus): boolean {
  return status === ReferralStatus.PENDING || status === ReferralStatus.ACCEPTED;
}

/** ข้อความปฏิเสธเมื่อมีเคสเปิดอยู่แล้วใน target เดียวกัน */
export function activeReferralConflictMessage(
  status: ReferralStatus,
  target?: ReferralTarget
): string {
  const targetLabel =
    target === ReferralTarget.COUNSELING_CENTER
      ? "ศูนย์ให้คำปรึกษา"
      : target === ReferralTarget.STUDENT_DEVELOPMENT
        ? "งานพัฒนานิสิต"
        : "ปลายทางนี้";

  return status === ReferralStatus.ACCEPTED
    ? `นิสิตคนนี้มีเคส${targetLabel}ที่กำลังดูแลอยู่แล้ว ไม่สามารถส่งต่อซ้ำได้`
    : `นิสิตคนนี้มีเคส${targetLabel}ที่รอรับอยู่แล้ว ไม่สามารถส่งต่อซ้ำได้`;
}

/** อนุญาตให้มี referral คนละ target พร้อมกันได้ — ชนเฉพาะ target เดียวกัน */
export function shouldBlockReferralForTarget(input: {
  existingTarget: ReferralTarget;
  requestedTarget: ReferralTarget;
}): boolean {
  return input.existingTarget === input.requestedTarget;
}
