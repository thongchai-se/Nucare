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

type ScoredSurveyQuestionOption = {
  label: string;
  score: number | null;
  value: string;
};

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

export const getSurveyQuestionMaxScore = (question: SurveyQuestionForScore): number => {
  if (question.type === SurveyQuestionType.SCALE || question.type === SurveyQuestionType.NUMBER) {
    return typeof question.maxValue === "number" && question.maxValue > 0 ? question.maxValue : 0;
  }

  const options = getChoiceOptions(question);

  if (question.type === SurveyQuestionType.SINGLE_CHOICE) {
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

export const calculateSurveyMaxScore = (questions: SurveyQuestionForScore[]): number =>
  questions.reduce((total, question) => total + getSurveyQuestionMaxScore(question), 0);

export const calculateSurveyScorePercent = (score: number | null, maxScore: number): number | null => {
  if (score === null || maxScore <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
};

export const calculateSurveyResponseScore = (
  questions: SurveyQuestionForScore[],
  answers: SurveyAnswerForScore[]
): number | null => {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  let hasScoredAnswer = false;

  const total = answers.reduce((score, answer) => {
    const question = questionById.get(answer.questionId);
    if (!question || getSurveyQuestionMaxScore(question) <= 0) {
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
      const selectedOption = options.find((option) => option.value === answer.value);
      hasScoredAnswer = true;
      return score + getOptionNumericScore(selectedOption);
    }

    if (question.type === SurveyQuestionType.MULTIPLE_CHOICE && Array.isArray(answer.value)) {
      hasScoredAnswer = true;
      const choiceScore = answer.value.reduce<number>((totalScore, value) => {
        const selectedOption = options.find((option) => option.value === String(value));
        return totalScore + getOptionNumericScore(selectedOption);
      }, 0);
      return score + choiceScore;
    }

    return score;
  }, 0);

  return hasScoredAnswer ? total : null;
};

export const isGhq28SurveyTitle = (title: string | null | undefined): boolean =>
  /GHQ\s*-?\s*28/i.test(title || "") || (title || "").includes("แบบทดสอบสุขภาพทั่วไป");

export const getSurveyRiskLevel = (
  surveyTitle: string,
  score: number | null,
  maxScore: number
): RiskLevel => {
  if (score === null || maxScore <= 0) {
    return RiskLevel.NORMAL;
  }

  if (isGhq28SurveyTitle(surveyTitle)) {
    return score >= 6 ? RiskLevel.HIGH : RiskLevel.NORMAL;
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
