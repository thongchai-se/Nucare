import { Prisma, RiskLevel, SurveyQuestionType } from "@prisma/client";

export type SurveyQuestionForScore = {
  id: string;
  type: SurveyQuestionType;
  options: Prisma.JsonValue | null;
  minValue: number | null;
  maxValue: number | null;
};

export type SurveyAnswerForScore = {
  questionId: string;
  value: unknown;
};

export type Ghq28DistressLevel = "NORMAL" | "MILD" | "MODERATE" | "SEVERE";

export type Ghq28DistressResult = {
  level: Ghq28DistressLevel;
  labelTh: string;
  labelEn: string;
};

type ScoredSurveyQuestionOption = {
  label: string;
  score: number | null;
  value: string;
};

export const GHQ28_MAX_SCORE = 84;

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getChoiceOptions = (question: SurveyQuestionForScore): ScoredSurveyQuestionOption[] => {
  if (!Array.isArray(question.options)) {
    return [];
  }

  return question.options.flatMap((option) => {
    if (typeof option !== "object" || option === null || Array.isArray(option)) {
      return [];
    }

    const record = option as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const value = typeof record.value === "string" ? record.value.trim() : "";
    const score = normalizeNullableNumber(record.score);

    return label && value ? [{ label, score, value }] : [];
  });
};

const getOptionNumericScore = (option: ScoredSurveyQuestionOption | undefined): number => {
  if (!option) {
    return 0;
  }

  if (typeof option.score === "number" && Number.isFinite(option.score)) {
    return option.score;
  }

  const parsedValue = Number(option.value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const isGhq28SurveyTitle = (title: string | null | undefined): boolean =>
  /GHQ\s*-?\s*28/i.test(title || "") || (title || "").includes("แบบทดสอบสุขภาพทั่วไป");

export const getGhq28OptionScore = (
  options: ScoredSurveyQuestionOption[],
  selectedValue: string
): number => {
  const index = options.findIndex((option) => option.value === selectedValue);
  return index >= 0 ? index : 0;
};

export const getGhq28DistressLevel = (score: number | null): Ghq28DistressResult | null => {
  if (score === null) {
    return null;
  }

  if (score <= 14) {
    return {
      level: "NORMAL",
      labelTh: "ปกติ (Normal)",
      labelEn: "Normal",
    };
  }

  if (score <= 28) {
    return {
      level: "MILD",
      labelTh: "ปัญหาสุขภาพจิตระดับน้อย (Mild Distress)",
      labelEn: "Mild Distress",
    };
  }

  if (score <= 42) {
    return {
      level: "MODERATE",
      labelTh: "ปัญหาสุขภาพจิตระดับปานกลาง (Moderate Distress)",
      labelEn: "Moderate Distress",
    };
  }

  return {
    level: "SEVERE",
    labelTh: "ปัญหาสุขภาพจิตระดับรุนแรง (Severe Distress)",
    labelEn: "Severe Distress",
  };
};

export const getGhq28RiskLevel = (score: number | null): RiskLevel => {
  const distress = getGhq28DistressLevel(score);
  if (!distress) {
    return RiskLevel.NORMAL;
  }

  switch (distress.level) {
    case "SEVERE":
      return RiskLevel.HIGH;
    case "MILD":
    case "MODERATE":
      return RiskLevel.MEDIUM;
    default:
      return RiskLevel.NORMAL;
  }
};

export const getSurveyQuestionMaxScore = (
  question: SurveyQuestionForScore,
  surveyTitle?: string | null
): number => {
  if (question.type === SurveyQuestionType.SCALE || question.type === SurveyQuestionType.NUMBER) {
    return typeof question.maxValue === "number" && question.maxValue > 0 ? question.maxValue : 0;
  }

  const options = getChoiceOptions(question);

  if (question.type === SurveyQuestionType.SINGLE_CHOICE) {
    if (isGhq28SurveyTitle(surveyTitle) && options.length >= 2) {
      return options.length - 1;
    }

    return Math.max(0, ...options.map((option) => getOptionNumericScore(option)));
  }

  if (question.type === SurveyQuestionType.MULTIPLE_CHOICE) {
    return options.reduce((total, option) => {
      const optionScore = getOptionNumericScore(option);
      return optionScore > 0 ? total + optionScore : total;
    }, 0);
  }

  return 0;
};

export const calculateSurveyMaxScore = (
  questions: SurveyQuestionForScore[],
  surveyTitle?: string | null
): number =>
  questions.reduce((total, question) => total + getSurveyQuestionMaxScore(question, surveyTitle), 0);

export const calculateSurveyScorePercent = (score: number | null, maxScore: number): number | null => {
  if (score === null || maxScore <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
};

export const calculateSurveyResponseScore = (
  questions: SurveyQuestionForScore[],
  answers: SurveyAnswerForScore[],
  surveyTitle?: string | null
): number | null => {
  const useGhq28Scoring = isGhq28SurveyTitle(surveyTitle);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  let hasScoredAnswer = false;

  const total = answers.reduce((score, answer) => {
    const question = questionById.get(answer.questionId);
    if (!question || getSurveyQuestionMaxScore(question, surveyTitle) <= 0) {
      return score;
    }

    if (question.type === SurveyQuestionType.SCALE || question.type === SurveyQuestionType.NUMBER) {
      const numericValue = Number(answer.value);
      if (!Number.isFinite(numericValue)) {
        return score;
      }

      hasScoredAnswer = true;
      return score + numericValue;
    }

    const options = getChoiceOptions(question);

    if (question.type === SurveyQuestionType.SINGLE_CHOICE && typeof answer.value === "string") {
      hasScoredAnswer = true;

      if (useGhq28Scoring) {
        return score + getGhq28OptionScore(options, answer.value);
      }

      const selectedOption = options.find((option) => option.value === answer.value);
      return score + getOptionNumericScore(selectedOption);
    }

    if (question.type === SurveyQuestionType.MULTIPLE_CHOICE && Array.isArray(answer.value)) {
      hasScoredAnswer = true;
      const choiceScore = answer.value.reduce<number>((totalScore, value) => {
        if (useGhq28Scoring) {
          return totalScore + getGhq28OptionScore(options, String(value));
        }

        const selectedOption = options.find((option) => option.value === String(value));
        return totalScore + getOptionNumericScore(selectedOption);
      }, 0);
      return score + choiceScore;
    }

    return score;
  }, 0);

  return hasScoredAnswer ? total : null;
};

export const getSurveyRiskLevel = (
  surveyTitle: string,
  score: number | null,
  maxScore: number
): RiskLevel => {
  if (score === null || maxScore <= 0) {
    return RiskLevel.NORMAL;
  }

  if (isGhq28SurveyTitle(surveyTitle)) {
    return getGhq28RiskLevel(score);
  }

  const ratio = score / maxScore;
  if (ratio >= 0.67) {
    return RiskLevel.HIGH;
  }

  if (ratio >= 0.34) {
    return RiskLevel.MEDIUM;
  }

  return RiskLevel.NORMAL;
};

export const getSurveyInstrumentLabel = (surveyTitle: string): string =>
  isGhq28SurveyTitle(surveyTitle) ? "GHQ-28" : surveyTitle;

export const enrichSurveyResponseScores = (
  surveyTitle: string,
  questions: SurveyQuestionForScore[],
  answers: SurveyAnswerForScore[]
): {
  totalScore: number | null;
  maxScore: number;
  scorePercent: number | null;
  riskLevel: RiskLevel;
  distressLevel: Ghq28DistressLevel | null;
  distressLabel: string | null;
} => {
  const maxScore = calculateSurveyMaxScore(questions, surveyTitle);
  const totalScore = calculateSurveyResponseScore(questions, answers, surveyTitle);
  const scorePercent = calculateSurveyScorePercent(totalScore, maxScore);
  const distress = isGhq28SurveyTitle(surveyTitle) ? getGhq28DistressLevel(totalScore) : null;
  const riskLevel = isGhq28SurveyTitle(surveyTitle)
    ? getGhq28RiskLevel(totalScore)
    : getSurveyRiskLevel(surveyTitle, totalScore, maxScore);

  return {
    totalScore,
    maxScore,
    scorePercent,
    riskLevel,
    distressLevel: distress?.level ?? null,
    distressLabel: distress?.labelTh ?? null,
  };
};

/** สรุปผลแบบประเมินที่ส่งกลับให้นิสิตดูเอง — ไม่รวมข้อมูลผู้อื่น */
export function buildStudentFacingSurveyResult(input: {
  id: string;
  submittedAt: Date | string;
  totalScore: number | null;
  maxScore: number;
  surveyTitle: string;
}): {
  id: string;
  submittedAt: string;
  totalScore: number | null;
  maxScore: number;
  distressLevel: Ghq28DistressLevel | null;
  distressLabel: string | null;
} {
  const distress =
    input.totalScore != null && isGhq28SurveyTitle(input.surveyTitle)
      ? getGhq28DistressLevel(input.totalScore)
      : null;

  return {
    id: input.id,
    submittedAt:
      typeof input.submittedAt === "string"
        ? input.submittedAt
        : input.submittedAt.toISOString(),
    totalScore: input.totalScore,
    maxScore: input.maxScore,
    distressLevel: distress?.level ?? null,
    distressLabel: distress?.labelTh ?? null,
  };
}
