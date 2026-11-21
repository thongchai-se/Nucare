export type ActiveView =
  | "dashboard"
  | "tracking"
  | "wellness"
  | "welfare"
  | "publicity"
  | "messages";

export type PendingStudent = {
  id: string;
  studentCode?: string;
  name: string;
  year: string;
  section?: string;
  advisorName?: string | null;
  latestReminderAt?: string | null;
  lastActive: string;
  status: string;
};

/** สรุปกลุ่มเสี่ยงจากผลคัดกรอง (ไม่ใช่กิจกรรมลงทะเบียน) */
export type RiskInsightCard = {
  id: string;
  name: string;
  date: string;
  /** จำนวนนิสิตในกลุ่มนี้ */
  registered: number;
  status: "กลุ่มเสี่ยงสูง" | "กลุ่มเสี่ยงปานกลาง" | "กลุ่มปกติ";
  focus: string;
};

/** @deprecated ใช้ RiskInsightCard — คงชื่อเดิมเพื่อไม่ให้ import เก่าพัง */
export type WellnessActivity = RiskInsightCard;

export type WelfareReferralStatus = "PENDING" | "ACCEPTED" | "CLOSED";

export type WelfareTask = {
  id: string;
  /** @deprecated ใช้ studentName + studentCode */
  title: string;
  studentName: string;
  studentCode: string;
  year: string;
  owner: string;
  status: "กำลังประสานงาน" | "รอประสานงาน" | "ปิดเคสแล้ว";
  referralStatus: WelfareReferralStatus;
  updatedAt: string;
  updatedAtRaw?: string;
  note: string;
  /** รหัสผู้ใช้นิสิต — ใช้เปิดคุยสั้น */
  studentUserId?: string | null;
  isUrgent?: boolean;
  acceptedByUserId?: string | null;
  acceptedByName?: string | null;
  staffNote?: string | null;
  closedReason?: string | null;
  phone?: string | null;
  guardianPhone?: string | null;
  email?: string | null;
};

export type ScreeningStats = {
  totalTarget: number;
  completed: number;
  pending: number;
  percentage: number;
  normalRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
};

export type ScreeningMeta = {
  hasOpenSurveyWave: boolean;
  openWaveLabel: string | null;
};

export type StudentDevelopmentAlert = {
  id: string;
  title: string;
  message: string;
  priority: string;
  createdAt: string;
  studentId: string | null;
};
