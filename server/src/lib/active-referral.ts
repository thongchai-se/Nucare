import { ReferralStatus, ReferralTarget } from "@prisma/client";
import { referralTargetLabel } from "./referral-labels";

export const ACTIVE_REFERRAL_STATUSES: ReferralStatus[] = [
  ReferralStatus.PENDING,
  ReferralStatus.ACCEPTED,
];

/** เคสส่งต่อที่ยังเปิดอยู่ (รอรับเคสหรือกำลังติดตาม) — ห้ามสร้างซ้ำใน target เดียวกัน */
export function isActiveReferralStatus(status: ReferralStatus): boolean {
  return status === ReferralStatus.PENDING || status === ReferralStatus.ACCEPTED;
}

/** ข้อความปฏิเสธเมื่อมีเคสเปิดอยู่แล้วใน target เดียวกัน */
export function activeReferralConflictMessage(
  status: ReferralStatus,
  target?: ReferralTarget
): string {
  const targetLabel = target ? referralTargetLabel(target) : "ปลายทางนี้";
  const isWelfare = target === ReferralTarget.STUDENT_DEVELOPMENT;
  if (status === ReferralStatus.ACCEPTED) {
    const openLabel = isWelfare ? "กำลังประสานงาน" : "กำลังดูแล";
    return `นิสิตคนนี้มีเคส${targetLabel}ที่${openLabel}อยู่แล้ว ไม่สามารถส่งต่อซ้ำได้`;
  }
  const pendingLabel = isWelfare ? "รอประสานงาน" : "รอรับเคส";
  return `นิสิตคนนี้มีเคส${targetLabel}ที่${pendingLabel}อยู่แล้ว ไม่สามารถส่งต่อซ้ำได้`;
}

/** อนุญาตให้มี referral คนละ target พร้อมกันได้ — ชนเฉพาะ target เดียวกัน */
export function shouldBlockReferralForTarget(input: {
  existingTarget: ReferralTarget;
  requestedTarget: ReferralTarget;
}): boolean {
  return input.existingTarget === input.requestedTarget;
}
