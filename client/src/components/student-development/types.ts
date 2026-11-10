import type { ReactNode } from "react";

export type ActiveView = "dashboard" | "tracking" | "wellness" | "welfare" | "publicity";

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
  registered: number;
  max: number;
  status: "กลุ่มเสี่ยงสูง" | "กลุ่มเสี่ยงปานกลาง" | "กลุ่มปกติ";
  focus: string;
};

/** @deprecated ใช้ RiskInsightCard — คงชื่อเดิมเพื่อไม่ให้ import เก่าพัง */
export type WellnessActivity = RiskInsightCard;

export type WelfareReferralStatus = "PENDING" | "ACCEPTED" | "CLOSED";

export type WelfareTask = {
  id: string;
  title: string;
  owner: string;
  status: "กำลังประสานงาน" | "รอรับงาน" | "ปิดงานแล้ว";
  referralStatus: WelfareReferralStatus;
  updatedAt: string;
  note: string;
  isUrgent?: boolean;
  acceptedByUserId?: string | null;
  acceptedByName?: string | null;
  staffNote?: string | null;
  closedReason?: string | null;
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

export type CampaignHighlight = {
  title: string;
  description: string;
  icon: ReactNode;
};
