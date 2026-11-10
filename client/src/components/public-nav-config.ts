export type PublicNavItem = {
  id: "media" | "support" | "resources" | "emergency";
  label: string;
};

export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { id: "media", label: "กิจกรรม" },
  { id: "support", label: "การดูแล" },
  { id: "resources", label: "คลังฮีลใจ" },
  { id: "emergency", label: "เหตุฉุกเฉิน" },
];

export const PUBLIC_NAV_LABELS = {
  login: "เข้าสู่ระบบ",
  assessment: "ทำแบบประเมิน",
  dashboard: "ไปที่แดชบอร์ด",
  logout: "ออกจากระบบ",
} as const;
