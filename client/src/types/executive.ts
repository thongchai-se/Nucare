export type Ghq28DistressLevel = "NORMAL" | "MILD" | "MODERATE" | "SEVERE";

export type DistressCounts = {
  NORMAL: number;
  MILD: number;
  MODERATE: number;
  SEVERE: number;
  unscreened: number;
};

export type RiskCounts = {
  NORMAL: number;
  MEDIUM: number;
  HIGH: number;
  unscreened: number;
};

export type CommonIssueItem = {
  label: string;
  count: number;
  percent: number;
};

export type TrendItem = {
  month: string;
  label: string;
  screened: number;
  highRisk: number;
  referrals: number;
  sos: number;
};

export type SectionStat = {
  section: string;
  totalStudents: number;
  screenedPercent: number;
  highRiskPercent: number;
};

export type StudyYearBucket = {
  studyYear: number | null;
  label: string;
  totalStudents: number;
  screenedCount: number;
  screenedPercent: number;
  distressCounts: DistressCounts;
  riskCounts: RiskCounts;
  highRiskPercent: number;
  avgGhq28Score: number | null;
  commonIssues: CommonIssueItem[];
  trends: TrendItem[];
  sections: SectionStat[];
};

export type ExecutiveOperationsStats = {
  avgConsultationResponseHours: number | null;
  caseClosureRate: number | null;
  openReferrals: number;
  openSos: number;
};

export type ExecutiveDashboardResponse = {
  generatedAt: string;
  activeSurvey: { id: string; title: string } | null;
  overall: StudyYearBucket;
  byStudyYear: StudyYearBucket[];
  operations: ExecutiveOperationsStats;
};

export type ExecutiveYearFilter = "ALL" | "1" | "2" | "3" | "4";
