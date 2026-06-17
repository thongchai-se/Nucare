import { RiskLevel, SurveyStatus } from "@prisma/client";
import { prisma } from "./prisma";
import {
  calculateSurveyMaxScore,
  calculateSurveyResponseScore,
  getSurveyInstrumentLabel,
  getSurveyRiskLevel,
} from "./survey-scoring";

export type LatestActiveSurveyResult = {
  assessedAt: Date;
  instrument: string;
  maxScore: number;
  riskLevel: RiskLevel;
  totalScore: number | null;
};

export const getLatestActiveSurveyResultsForStudents = async (
  studentIds: string[]
): Promise<Map<string, LatestActiveSurveyResult>> => {
  const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];
  if (uniqueStudentIds.length === 0) {
    return new Map();
  }

  const now = new Date();
  const survey = await prisma.survey.findFirst({
    where: {
      status: SurveyStatus.PUBLISHED,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      responses: {
        where: {
          studentId: {
            in: uniqueStudentIds,
          },
        },
        orderBy: {
          submittedAt: "desc",
        },
        include: {
          answers: true,
        },
      },
    },
  });

  if (!survey) {
    return new Map();
  }

  const maxScore = calculateSurveyMaxScore(survey.questions);
  const instrument = getSurveyInstrumentLabel(survey.title);
  const results = new Map<string, LatestActiveSurveyResult>();

  for (const response of survey.responses) {
    if (results.has(response.studentId)) {
      continue;
    }

    const responseMaxScore = response.maxScore > 0 ? response.maxScore : maxScore;
    const totalScore = response.totalScore ?? calculateSurveyResponseScore(survey.questions, response.answers);
    results.set(response.studentId, {
      assessedAt: response.submittedAt,
      instrument: response.instrument ?? instrument,
      maxScore: responseMaxScore,
      riskLevel:
        response.totalScore === null || response.maxScore <= 0
          ? getSurveyRiskLevel(survey.title, totalScore, responseMaxScore)
          : response.riskLevel,
      totalScore,
    });
  }

  return results;
};
