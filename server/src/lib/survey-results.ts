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
  type SurveyQuestionForScore,
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
 * ใช้คะแนนใน response เป็นหลัก — โหลด answers เฉพาะแถวที่ยังไม่มีคะแนน
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
    orderBy: [{ studentId: "asc" }, { submittedAt: "desc" }],
    distinct: ["studentId"],
    select: {
      id: true,
      studentId: true,
      submittedAt: true,
      totalScore: true,
      maxScore: true,
      riskLevel: true,
      instrument: true,
      waveId: true,
      surveyId: true,
      wave: { select: { id: true, label: true } },
      survey: {
        select: {
          title: true,
        },
      },
    },
  });

  const needsRescoreIds = responses
    .filter((response) => response.totalScore === null || response.maxScore <= 0)
    .map((response) => response.id);

  const answersByResponseId = new Map<
    string,
    Array<{ questionId: string; value: unknown }>
  >();
  const questionsBySurveyId = new Map<string, SurveyQuestionForScore[]>();

  if (openWave?.survey) {
    questionsBySurveyId.set(openWave.surveyId, openWave.survey.questions);
  }

  if (needsRescoreIds.length > 0) {
    const answerRows = await prisma.surveyAnswer.findMany({
      where: { responseId: { in: needsRescoreIds } },
      select: { responseId: true, questionId: true, value: true },
    });
    for (const row of answerRows) {
      const list = answersByResponseId.get(row.responseId) ?? [];
      list.push({ questionId: row.questionId, value: row.value });
      answersByResponseId.set(row.responseId, list);
    }

    const surveyIdsNeedingQuestions = [
      ...new Set(
        responses
          .filter((response) => needsRescoreIds.includes(response.id))
          .map((response) => response.surveyId)
          .filter((surveyId) => !questionsBySurveyId.has(surveyId))
      ),
    ];

    if (surveyIdsNeedingQuestions.length > 0) {
      const surveys = await prisma.survey.findMany({
        where: { id: { in: surveyIdsNeedingQuestions } },
        select: {
          id: true,
          questions: { orderBy: { order: "asc" } },
        },
      });
      for (const survey of surveys) {
        questionsBySurveyId.set(survey.id, survey.questions);
      }
    }
  }

  const results = new Map<string, LatestActiveSurveyResult>();

  for (const response of responses) {
    const surveyTitle = openWave?.survey.title ?? response.survey.title;
    const questions =
      questionsBySurveyId.get(openWave?.surveyId ?? response.surveyId) ??
      questionsBySurveyId.get(response.surveyId) ??
      [];
    const maxScoreFromQuestions =
      questions.length > 0 ? calculateSurveyMaxScore(questions, surveyTitle) : 0;
    const instrument = getSurveyInstrumentLabel(surveyTitle);
    const responseMaxScore =
      response.maxScore > 0 ? response.maxScore : maxScoreFromQuestions;

    let totalScore = response.totalScore;
    if (totalScore === null || response.maxScore <= 0) {
      const answers = answersByResponseId.get(response.id) ?? [];
      totalScore = calculateSurveyResponseScore(questions, answers, surveyTitle);
    }

    const distress = isGhq28SurveyTitle(surveyTitle) ? getGhq28DistressLevel(totalScore) : null;
    const computedRiskLevel = isGhq28SurveyTitle(surveyTitle)
      ? getGhq28RiskLevel(totalScore)
      : getSurveyRiskLevel(surveyTitle, totalScore, responseMaxScore);

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
