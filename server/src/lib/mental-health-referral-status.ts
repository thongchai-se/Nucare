import { ReferralStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<ReferralStatus, ReadonlySet<ReferralStatus>> = {
  [ReferralStatus.PENDING]: new Set([ReferralStatus.ACCEPTED, ReferralStatus.CLOSED]),
  [ReferralStatus.ACCEPTED]: new Set([ReferralStatus.CLOSED]),
  [ReferralStatus.CLOSED]: new Set(),
};

/** ตรวจว่าสถานะ referral ของผู้เชี่ยวชาญเปลี่ยนได้ตามลำดับคิวหรือไม่ */
export function canTransitionMentalHealthReferralStatus(
  from: ReferralStatus,
  to: ReferralStatus
): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

/** ข้อความอธิบายเมื่อเปลี่ยนสถานะไม่ได้ */
export function mentalHealthReferralTransitionError(
  from: ReferralStatus,
  to: ReferralStatus
): string {
  if (from === ReferralStatus.CLOSED) {
    return "เคสที่ปิดแล้วไม่สามารถเปลี่ยนสถานะได้";
  }
  if (from === ReferralStatus.PENDING && to !== ReferralStatus.ACCEPTED && to !== ReferralStatus.CLOSED) {
    return "คิวรอดำเนินการรับได้เฉพาะ รับเคส หรือปฏิเสธ/ปิดคิว";
  }
  if (from === ReferralStatus.ACCEPTED && to !== ReferralStatus.CLOSED) {
    return "เคสที่รับแล้วปิดได้เท่านั้น";
  }
  return `ไม่สามารถเปลี่ยนสถานะจาก ${from} เป็น ${to}`;
}
