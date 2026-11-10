import type { AdvisorReferralItem, ReferralStatus } from "./types";

/** เคสส่งต่อที่ยังไม่ปิด — ห้ามกดส่งต่อซ้ำ */
export function hasActiveReferral(status: ReferralStatus | null | undefined): boolean {
  return status === "PENDING" || status === "ACCEPTED";
}

/**
 * เลือกเคสส่งต่อที่ควรใช้ตัดสินใจปุ่มส่งต่อ — ถ้ามีเคสเปิดอยู่ให้ใช้เคสนั้น
 * ไม่ใช้ CLOSED ล่าสุดบังคับทับเคสเปิดที่เก่ากว่า
 */
export function pickReferralForStudent(
  referrals: readonly AdvisorReferralItem[],
  studentId: string
): AdvisorReferralItem | undefined {
  let active: AdvisorReferralItem | undefined;
  let latest: AdvisorReferralItem | undefined;

  for (const referral of referrals) {
    if (referral.studentId !== studentId) {
      continue;
    }
    if (!latest) {
      latest = referral;
    }
    if (!active && hasActiveReferral(referral.status)) {
      active = referral;
      break;
    }
  }

  return active ?? latest;
}
