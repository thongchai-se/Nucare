import { ReferralTarget } from "@prisma/client";

/** ป้ายปลายทางส่งต่อ — ให้ตรงกันทั้ง API และ UI */
export const REFERRAL_TARGET_LABEL: Record<ReferralTarget, string> = {
  [ReferralTarget.COUNSELING_CENTER]: "ศูนย์ให้คำปรึกษา",
  [ReferralTarget.STUDENT_DEVELOPMENT]: "งานพัฒนานิสิต",
};

/** คืนป้ายปลายทางส่งต่อภาษาไทย */
export function referralTargetLabel(target: ReferralTarget): string {
  return REFERRAL_TARGET_LABEL[target] ?? target;
}
