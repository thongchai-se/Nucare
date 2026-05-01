export type PublicNavItem = {
  id: "support" | "resources" | "emergency";
  label: string;
};

export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { id: "support", label: "การดูแล" },
  { id: "resources", label: "คลังฮีลใจ" },
  { id: "emergency", label: "เหตุฉุกเฉิน" },
];

export const PUBLIC_NAV_LABELS = {
  login: "เข้าสู่ระบบ",
  assessment: "ทำแบบประเมิน",
  dashboard: "ไปที่แดชบอร์ด",
  changePassword: "เปลี่ยนรหัสผ่าน",
  logout: "ออกจากระบบ",
} as const;
