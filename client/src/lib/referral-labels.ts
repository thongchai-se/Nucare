/** ป้ายปลายทางส่งต่อ — ให้ตรงกันทั้งหน้าที่ปรึกษา คิวทบทวน และฝั่งเซิร์ฟเวอร์ */
export const REFERRAL_TARGET_LABEL = {
  COUNSELING_CENTER: "ศูนย์ให้คำปรึกษา",
  STUDENT_DEVELOPMENT: "งานพัฒนานิสิต",
} as const;

export type ReferralTargetKey = keyof typeof REFERRAL_TARGET_LABEL;
