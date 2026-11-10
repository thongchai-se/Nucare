export type SurveyStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SurveyFrequency = "ONE_SHOT" | "WEEKLY" | "ACADEMIC_TERM" | "CUSTOM_INTERVAL";

export type SurveyScheduleUnit = "DAYS" | "WEEKS" | "MONTHS";

export type SurveyAudienceType = "ALL_STUDENTS" | "RULE_BASED";

export type SurveyInstrumentCode = "GHQ28" | "CUSTOM";

export type SurveyWaveStatus = "SCHEDULED" | "OPEN" | "CLOSED" | "CANCELLED";

export type SurveyQuestionType =
  | "TEXT"
  | "TEXTAREA"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "SCALE"
  | "NUMBER"
  | "DATE";

export type SurveyRiskLevel = "NORMAL" | "MEDIUM" | "HIGH";

export type WellnessTrendSignalCode =
  | "DEPRESSIVE_THEME"
  | "ANXIETY_THEME"
  | "ACADEMIC_STRESS"
  | "SLEEP_DISTURBANCE"
  | "LONELINESS_ISOLATION"
  | "RELATIONSHIP_STRESS"
  | "BURNOUT_FATIGUE"
  | "SELF_HARM_CRISIS";

export type SurveyQuestionOption = {
  label: string;
  score?: number | null;
  value: string;
};

export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  description: string | null;
  isRequired: boolean;
  order: number;
  options: SurveyQuestionOption[];
  minValue: number | null;
  maxValue: number | null;
};

export type SurveyEligibilityRule = {
  priorRiskLevels: SurveyRiskLevel[];
  wellnessSignalCodes: WellnessTrendSignalCode[];
  studyYears: number[];
  sections: string[];
};

export type SurveyWaveSummary = {
  id: string;
  label: string;
  status: SurveyWaveStatus;
  opensAt: string;
  closesAt: string | null;
  termKey: string | null;
  assignmentCount?: number;
  responseCount?: number;
};

export type Survey = {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  frequency?: SurveyFrequency;
  scheduleEvery?: number | null;
  scheduleUnit?: SurveyScheduleUnit | null;
  audienceType?: SurveyAudienceType;
  instrumentCode?: SurveyInstrumentCode;
  eligibilityRule?: SurveyEligibilityRule | null;
  waves?: SurveyWaveSummary[];
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  responseCount: number;
  questions: SurveyQuestion[];
  createdBy?: {
    id: string;
    name: string;
  } | null;
};

/** Payload ที่นักศึกษามองเห็น — ไม่มีคะแนนใน options และไม่มีเหตุผลคัดเลือก */
export type StudentFacingSurvey = {
  id: string;
  title: string;
  description: string | null;
  waveId: string;
  waveLabel: string;
  closesAt: string | null;
  questions: Array<Omit<SurveyQuestion, "options"> & { options: Array<{ label: string; value: string }> }>;
};

export type SurveyAnswerValue = string | number | string[];
export type Ghq28DistressLevel = "NORMAL" | "MILD" | "MODERATE" | "SEVERE";

export type ActiveStudentSurveyResult = {
  id: string;
  submittedAt: string;
  totalScore?: number | null;
  maxScore?: number | null;
  distressLevel?: Ghq28DistressLevel | null;
  distressLabel?: string | null;
};

export type SurveyResponseRow = {
  id: string;
  submittedAt: string;
  totalScore: number | null;
  maxScore: number;
  scorePercent: number | null;
  riskLevel: SurveyRiskLevel;
  instrument: string | null;
  scoredAt: string | null;
  distressLevel?: Ghq28DistressLevel | null;
  distressLabel?: string | null;
  student: {
    id: string;
    name: string;
    studentId: string | null;
    email?: string | null;
    studyYear: number | null;
    section: string | null;
  };
};
