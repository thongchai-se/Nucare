export type ExecutiveReferralRoadmapStep = {
  key: string;
  label: string;
  at: string;
  actorName?: string;
  detail?: string;
  kind: "sent" | "accepted" | "care" | "closed";
};

export type ExecutiveReferralCaseListItem = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  studyYear: string;
  target: "COUNSELING_CENTER" | "STUDENT_DEVELOPMENT";
  targetLabel: string;
  status: "PENDING" | "ACCEPTED" | "CLOSED";
  statusLabel: string;
  isUrgent: boolean;
  reason: string;
  advisorName: string;
  acceptedByName: string | null;
  currentOwnerName: string | null;
  careSessionCount: number;
  staffNote: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
  roadmap: ExecutiveReferralRoadmapStep[];
};

export type ExecutiveReferralCaseDetail = ExecutiveReferralCaseListItem & {
  careNotes: Array<{
    id: string;
    sessionDate: string;
    summary: string;
    interventionPlan: string;
    providerName: string;
  }>;
};

export type ExecutiveReferralStats = {
  total: number;
  pending: number;
  accepted: number;
  closed: number;
  urgentOpen: number;
  byTarget: Array<{
    target: "COUNSELING_CENTER" | "STUDENT_DEVELOPMENT";
    label: string;
    count: number;
  }>;
};

export type ExecutiveReferralListResponse = {
  items: ExecutiveReferralCaseListItem[];
  stats: ExecutiveReferralStats;
};
