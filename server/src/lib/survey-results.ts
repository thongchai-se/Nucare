import { RiskLevel, SurveyStatus, SurveyWaveStatus } from "@prisma/client";
import { prisma } from "./prisma";
import {
  calculateSurveyMaxScore,
  calculateSurveyResponseScore,
  getGhq28DistressLevel,
  getGhq28RiskLevel,
  getSurveyInstrumentLabel,
  getSurveyRiskLevel,
  Ghq28DistressLevel,
  isGhq28SurveyTitle,
} from "./survey-scoring";

export type LatestActiveSurveyResult = {
  assessedAt: Date;
  instrument: string;
  maxScore: number;
  riskLevel: RiskLevel;
  totalScore: number | null;
  distressLevel: Ghq28DistressLevel | null;
  distressLabel: string | null;
  waveId?: string;
  waveLabel?: string;
};

/**
 * ดึงผลแบบประเมินล่าสุดต่อนักศึกษาจากคลื่นที่เปิด หรือผลล่าสุดข้ามคลื่นถ้าไม่มีคลื่นเปิด
 */
export const getLatestActiveSurveyResultsForStudents = async (
  studentIds: string[]
): Promise<Map<string, LatestActiveSurveyResult>> => {
  const uniqueStudentIds = [...new Set(studentIds.filter(Boolean))];
  if (uniqueStudentIds.length === 0) {
    return new Map();
  }

  const now = new Date();
  const openWave = await prisma.surveyWave.findFirst({
    where: {
      status: SurveyWaveStatus.OPEN,
      opensAt: { lte: now },
      OR: [{ closesAt: null }, { closesAt: { gte: now } }],
      survey: { status: SurveyStatus.PUBLISHED },
    },
    orderBy: [{ opensAt: "desc" }],
    include: {
      survey: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  const responses = await prisma.surveyResponse.findMany({
    where: {
      studentId: { in: uniqueStudentIds },
      ...(openWave ? { waveId: openWave.id } : {}),
    },
    orderBy: { submittedAt: "desc" },
    include: {
      answers: true,
      wave: { select: { id: true, label: true } },
      survey: {
        include: {
          questions: { orderBy: { order: "asc" } },
        },
      },
    },
  });

  const results = new Map<string, LatestActiveSurveyResult>();

  for (const response of responses) {
    if (results.has(response.studentId)) {
      continue;
    }

    const survey = openWave?.survey ?? response.survey;
    const maxScore = calculateSurveyMaxScore(survey.questions, survey.title);
    const instrument = getSurveyInstrumentLabel(survey.title);
    const responseMaxScore = response.maxScore > 0 ? response.maxScore : maxScore;
    const totalScore =
      response.totalScore ??
      calculateSurveyResponseScore(survey.questions, response.answers, survey.title);
    const distress = isGhq28SurveyTitle(survey.title) ? getGhq28DistressLevel(totalScore) : null;
    const computedRiskLevel = isGhq28SurveyTitle(survey.title)
      ? getGhq28RiskLevel(totalScore)
      : getSurveyRiskLevel(survey.title, totalScore, responseMaxScore);

    results.set(response.studentId, {
      assessedAt: response.submittedAt,
      instrument: response.instrument ?? instrument,
      maxScore: responseMaxScore,
      riskLevel:
        response.totalScore === null || response.maxScore <= 0
          ? computedRiskLevel
          : response.riskLevel,
      totalScore,
      distressLevel: distress?.level ?? null,
      distressLabel: distress?.labelTh ?? null,
      waveId: response.waveId,
      waveLabel: response.wave?.label ?? openWave?.label,
    });
  }

  return results;
};
