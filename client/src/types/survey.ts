export type SurveyStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type SurveyQuestionType =
  | "TEXT"
  | "TEXTAREA"
  | "SINGLE_CHOICE"
  | "MULTIPLE_CHOICE"
  | "SCALE"
  | "NUMBER"
  | "DATE";

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

export type Survey = {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
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

export type SurveyAnswerValue = string | number | string[];
export type SurveyRiskLevel = "NORMAL" | "MEDIUM" | "HIGH";

export type ActiveStudentSurveyResult = {
  id: string;
  submittedAt: string;
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
  student: {
    id: string;
    name: string;
    studentId: string | null;
    email?: string | null;
    studyYear: number | null;
    section: string | null;
  };
};
