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

/** ตัวกรองรายชื่อมอบหมายต่อรอบ — ตรงกับ query `status` ของ API */
export type SurveyAssignmentStatusFilter = "all" | "completed" | "pending" | "overdue";

/** สถานะของแถวรายชื่อมอบหมายที่แสดงในตาราง */
export type SurveyAssignmentRowStatus = "completed" | "pending" | "overdue";

/** แถวรายชื่อนักศึกษาที่ถูกมอบหมายแบบสอบถามในรอบหนึ่ง (ไม่มีคำตอบ/คะแนน) */
export type SurveyAssignmentRosterRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string | null;
  studyYear: number | null;
  section: string | null;
  eligibleAt: string | null;
  completedAt: string | null;
  status: SurveyAssignmentRowStatus;
  responseId: string | null;
};

export type SurveyAssignmentRosterSummary = {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
};

export type SurveyAssignmentRosterResponse = {
  assignments: SurveyAssignmentRosterRow[];
  summary: SurveyAssignmentRosterSummary;
};

/** ผลโหลดรายชื่อมอบหมายล่าสุดของหนึ่งรอบ ผูกกับ waveId + ตัวกรองเพื่อกันแสดงข้อมูลเก่าข้ามรอบ */
export type SurveyAssignmentRosterState = {
  rows: SurveyAssignmentRosterRow[];
  status: SurveyAssignmentStatusFilter;
  summary: SurveyAssignmentRosterSummary;
  waveId: string;
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

export type SurveyVersionStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** กฎคะแนนที่แอดมินกำหนดต่อเวอร์ชัน — riskCutoffs เป็นสัดส่วน 0–1 ของคะแนนเต็ม (ใช้กับ CUSTOM เท่านั้น) */
export type SurveyScoringRules = {
  maxScore?: number;
  riskCutoffs?: { medium: number; high: number };
  note?: string;
};

/** สรุปเวอร์ชันแบบประเมินจาก GET /versions และ POST /publish-version (ไม่รวมตัวคำถาม) */
export type SurveyVersionSummary = {
  id: string;
  version: number;
  status: SurveyVersionStatus;
  title: string;
  instrumentCode: SurveyInstrumentCode;
  scoringRules: SurveyScoringRules | null;
  publishedAt: string | null;
  createdAt: string;
  questionCount: number;
  waveCount: number;
  responseCount: number;
};

/** พรีวิวแบบประเมินมุมมองนักศึกษาจาก GET /preview (ตัดคะแนนในตัวเลือกออกแล้ว) */
export type SurveyAdminPreview = {
  id: string;
  title: string;
  description: string | null;
  questions: Array<Omit<SurveyQuestion, "options"> & { options: Array<{ label: string; value: string }> }>;
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
