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

export type ExecutiveOperationsStats = {
  avgConsultationResponseHours: number | null;
  caseClosureRate: number | null;
  openReferrals: number;
  openSos: number;
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
  operations: ExecutiveOperationsStats;
};

export type ExecutiveDashboardResponse = {
  generatedAt: string;
  activeSurvey: { id: string; title: string } | null;
  overall: StudyYearBucket;
  byStudyYear: StudyYearBucket[];
  operations: ExecutiveOperationsStats;
};

export type ExecutiveYearFilter = "ALL" | "1" | "2" | "3" | "4";

export type ScreeningRoundInfo = {
  id: string;
  title: string;
  startsAt: string | null;
  responseCount: number;
};

export type ScreeningRoundScore = {
  score: number;
  distressLabel: string;
  submittedAt: string;
};

export type ScreeningComparisonRow = {
  studentCode: string;
  studyYear: number | null;
  section: string | null;
  round1: ScreeningRoundScore;
  round2: ScreeningRoundScore;
  deltaScore: number;
  distressChange: string | null;
};

export type ScreeningComparisonSummary = {
  comparedCount: number;
  improvedCount: number;
  worsenedCount: number;
  unchangedCount: number;
  avgRound1Score: number | null;
  avgRound2Score: number | null;
  avgDelta: number | null;
};

export type ScreeningComparisonResponse = {
  generatedAt: string;
  availableRounds: ScreeningRoundInfo[];
  round1: ScreeningRoundInfo | null;
  round2: ScreeningRoundInfo | null;
  summary: ScreeningComparisonSummary;
  rows: ScreeningComparisonRow[];
};
