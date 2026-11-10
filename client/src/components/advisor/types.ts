export type StudentRiskLevel = "high" | "medium" | "normal";
export type ReferralTarget = "STUDENT_DEVELOPMENT" | "COUNSELING_CENTER";
export type ReferralStatus = "PENDING" | "ACCEPTED" | "CLOSED";
export type ConsultationRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "CANCEL_REQUESTED"
  | "CLOSED"
  | "CANCELLED";

export type RiskMeta = {
  label: string;
  badgeClassName: string;
  dotClassName: string;
};

export type WellnessSignalItem = {
  code: string;
  labelTh: string;
  shortLabelTh: string;
  occurrenceCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
};

export type AdvisorStudent = {
  id: string;
  studentId: string | null;
  name: string;
  year: string;
  riskLevel: StudentRiskLevel;
  lastAssessment: string | null;
  careRecordCount: number;
  behaviorRecordCount: number;
  image: string;
  latestScore: number | null;
  latestInstrument: string | null;
  wellnessSignals?: WellnessSignalItem[];
  hasCrisisWellnessSignal?: boolean;
};

export type ReferralRoadmapStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  detail?: string;
  kind?: "sent" | "accepted" | "care" | "closed";
};

export type AdvisorReferralItem = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  year: string;
  target: ReferralTarget;
  reason: string;
  isUrgent: boolean;
  status: ReferralStatus;
  createdAt: string;
  updatedAt: string;
  currentOwnerName: string | null;
  currentOwnerAssignedAt: string | null;
  careSessionCount: number;
  latestCareSessionAt: string | null;
  roadmap?: ReferralRoadmapStep[];
};

export type ConsultationScheduleOfferItem = {
  id: string;
  proposedAt: string;
  location: string;
  note: string | null;
  status: "PENDING" | "ACCEPTED" | "SUPERSEDED" | "CANCELLED";
  createdAt: string;
  proposedById: string;
  proposedByName: string;
  proposedByRole: "ADVISOR" | "STUDENT";
  waitingOn: "ADVISOR" | "STUDENT" | null;
};

export type ConsultationTab = "pending" | "accepted" | "scheduled" | "closed";

export type AdvisorConsultationRequestItem = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  year: string;
  topic: string;
  preferredChannel: string;
  preferredChannelLabel: string;
  note: string | null;
  status: ConsultationRequestStatus;
  advisorNote: string | null;
  scheduledAt: string | null;
  scheduleLocation: string | null;
  acceptedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  alertId: string | null;
  latestPendingOffer?: ConsultationScheduleOfferItem | null;
  scheduleOffers?: ConsultationScheduleOfferItem[];
};

export type AdvisorAlertItem = {
  id: string;
  type: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  sourceType: string | null;
  sourceId: string | null;
  /** นิสิตที่เกี่ยวข้อง — ใช้เปิดประวัติ/ส่งต่อจากคิวแจ้งเตือน */
  studentId: string | null;
  createdAt: string;
};

export type AdvisorHistoryItem = {
  id: string;
  kind: "CARE" | "REFERRAL" | "BEHAVIOR" | "CONSULTATION";
  date: string;
  type: string;
  topic: string;
  action: string;
  outcome: string | null;
  actorName: string;
  isUrgent: boolean;
};
