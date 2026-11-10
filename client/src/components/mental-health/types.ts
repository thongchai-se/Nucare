export type MentalHealthCareSession = {
  id: string;
  sessionDate: string;
  summary: string;
  interventionPlan: string;
  providerName: string;
  createdAt: string;
};

export type MentalHealthReferral = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "CLOSED";
  reason: string;
  isUrgent: boolean;
  createdAt: string;
  updatedAt: string;
  advisorName: string;
  currentOwnerName: string | null;
  currentOwnerAssignedAt: string | null;
  careSessionCount: number;
  latestCareSessionAt: string | null;
  recentCareSessions?: MentalHealthCareSession[];
  student: {
    id: string;
    studentId: string | null;
    name: string;
    year: string;
    riskLevel: "high" | "medium" | "normal";
    latestAssessment: {
      totalScore: number | null;
      instrument: string;
      assessedAt: string;
    } | null;
  };
};

export type MentalHealthAlert = {
  id: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  createdAt: string;
};

export type MentalHealthEmergencyCase = {
  id: string;
  summary: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  openedAt: string;
  student: {
    id: string;
    name: string;
    studentId: string | null;
    year: string;
  };
};

export type MentalHealthCase = {
  referralId: string;
  studentId: string;
  name: string;
  maskedStudentId: string;
  year: string;
  riskLevel: "high" | "medium" | "normal";
  advisorName: string;
  reason: string;
  isUrgent: boolean;
  status: "PENDING" | "ACCEPTED" | "CLOSED";
  createdAt: string;
  lastUpdatedAt: string;
  currentOwnerName: string | null;
  currentOwnerAssignedAt: string | null;
  careSessionCount: number;
  latestCareSessionAt: string | null;
  recentCareSessions: MentalHealthCareSession[];
  latestAssessment: MentalHealthReferral["student"]["latestAssessment"];
};

export type MentalHealthAppointmentStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export type MentalHealthAppointment = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  time: string;
  location: string;
  note: string;
  status: MentalHealthAppointmentStatus;
  providerName?: string;
};

export type RiskClasses = {
  /** พื้นทึบ + ตัวอักษรขาว — ใช้เป็น pill เท่านั้น */
  badge: string;
  chip: string;
  /** สีตัวอักษรบนพื้นอ่อน (≥4.5:1) — ห้ามใช้ text จาก badge */
  text: string;
  label: string;
};
