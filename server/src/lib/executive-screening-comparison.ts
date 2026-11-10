import { SurveyInstrumentCode, SurveyStatus, SurveyQuestionType, Prisma } from "@prisma/client";
import {
  calculateSurveyMaxScore,
  calculateSurveyResponseScore,
  getGhq28DistressLevel,
  isGhq28SurveyTitle,
} from "./survey-scoring";
import { normalizeStudyYearKey } from "./executive-analytics";
import { formatStudentIdForResponse } from "./user-format";
import { prisma } from "./prisma";

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

export type ScreeningComparisonPayload = {
  generatedAt: string;
  availableRounds: ScreeningRoundInfo[];
  round1: ScreeningRoundInfo | null;
  round2: ScreeningRoundInfo | null;
  summary: ScreeningComparisonSummary;
  rows: ScreeningComparisonRow[];
};

export type StudyYearComparisonFilter = number | null | "ALL";

type StudentInfo = {
  studentCode: string;
  studyYear: number | null;
  section: string | null;
};

type ResponseScore = {
  score: number;
  distressLabel: string;
  submittedAt: Date;
};

const matchesStudyYearFilter = (
  studyYear: number | null,
  filterStudyYear: StudyYearComparisonFilter
): boolean => {
  if (filterStudyYear === "ALL") {
    return true;
  }

  return normalizeStudyYearKey(studyYear) === filterStudyYear;
};

export const formatDistressChange = (
  round1Label: string,
  round2Label: string
): string | null => (round1Label === round2Label ? null : `${round1Label} → ${round2Label}`);

export const buildScreeningComparisonSummary = (
  rows: ScreeningComparisonRow[]
): ScreeningComparisonSummary => {
  if (rows.length === 0) {
    return {
      comparedCount: 0,
      improvedCount: 0,
      worsenedCount: 0,
      unchangedCount: 0,
      avgRound1Score: null,
      avgRound2Score: null,
      avgDelta: null,
    };
  }

  const improvedCount = rows.filter((row) => row.deltaScore < 0).length;
  const worsenedCount = rows.filter((row) => row.deltaScore > 0).length;
  const unchangedCount = rows.filter((row) => row.deltaScore === 0).length;
  const round1Total = rows.reduce((sum, row) => sum + row.round1.score, 0);
  const round2Total = rows.reduce((sum, row) => sum + row.round2.score, 0);
  const deltaTotal = rows.reduce((sum, row) => sum + row.deltaScore, 0);

  return {
    comparedCount: rows.length,
    improvedCount,
    worsenedCount,
    unchangedCount,
    avgRound1Score: Math.round((round1Total / rows.length) * 10) / 10,
    avgRound2Score: Math.round((round2Total / rows.length) * 10) / 10,
    avgDelta: Math.round((deltaTotal / rows.length) * 10) / 10,
  };
};

export const buildScreeningComparisonRows = (input: {
  round1Responses: Map<string, ResponseScore>;
  round2Responses: Map<string, ResponseScore>;
  students: Map<string, StudentInfo>;
  filterStudyYear?: StudyYearComparisonFilter;
}): ScreeningComparisonRow[] => {
  const filterStudyYear = input.filterStudyYear ?? "ALL";
  const rows: ScreeningComparisonRow[] = [];

  input.round1Responses.forEach((round1, studentId) => {
    const round2 = input.round2Responses.get(studentId);
    const student = input.students.get(studentId);

    if (!round2 || !student) {
      return;
    }

    if (!matchesStudyYearFilter(student.studyYear, filterStudyYear)) {
      return;
    }

    const deltaScore = round2.score - round1.score;

    rows.push({
      studentCode: student.studentCode,
      studyYear: student.studyYear,
      section: student.section,
      round1: {
        score: round1.score,
        distressLabel: round1.distressLabel,
        submittedAt: round1.submittedAt.toISOString(),
      },
      round2: {
        score: round2.score,
        distressLabel: round2.distressLabel,
        submittedAt: round2.submittedAt.toISOString(),
      },
      deltaScore,
      distressChange: formatDistressChange(round1.distressLabel, round2.distressLabel),
    });
  });

  return rows.sort((left, right) => left.studentCode.localeCompare(right.studentCode, "th"));
};

const serializeRoundInfo = (round: {
  id: string;
  title: string;
  startsAt: Date | null;
  responseCount: number;
}): ScreeningRoundInfo => ({
  id: round.id,
  title: round.title,
  startsAt: round.startsAt?.toISOString() ?? null,
  responseCount: round.responseCount,
});

const resolveResponseScore = (
  survey: {
    title: string;
    questions: Array<{
      id: string;
      type: SurveyQuestionType;
      options: Prisma.JsonValue | null;
      minValue: number | null;
      maxValue: number | null;
    }>;
  },
  response: {
    totalScore: number | null;
    maxScore: number;
    submittedAt: Date;
    answers: Array<{ questionId: string; value: unknown }>;
  }
): ResponseScore => {
  const totalScore =
    response.totalScore ??
    calculateSurveyResponseScore(survey.questions, response.answers, survey.title) ??
    0;
  const distress = getGhq28DistressLevel(totalScore);

  return {
    score: totalScore,
    distressLabel: distress?.labelTh ?? "ไม่ระบุ",
    submittedAt: response.submittedAt,
  };
};

const pickDefaultRounds = (
  rounds: ScreeningRoundInfo[]
): { round1: ScreeningRoundInfo | null; round2: ScreeningRoundInfo | null } => {
  const withResponses = rounds.filter((round) => round.responseCount > 0);

  if (withResponses.length < 2) {
    return { round1: null, round2: null };
  }

  const [round1, round2] = withResponses.slice(-2);
  return { round1, round2 };
};

export const buildScreeningRoundComparison = async (input?: {
  fromSurveyId?: string;
  toSurveyId?: string;
  studyYear?: StudyYearComparisonFilter;
}): Promise<ScreeningComparisonPayload> => {
  const studyYearFilter = input?.studyYear ?? "ALL";

  const waves = await prisma.surveyWave.findMany({
    where: {
      survey: {
        status: SurveyStatus.PUBLISHED,
      },
    },
    orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
    include: {
      survey: {
        include: {
          questions: {
            orderBy: { order: "asc" },
          },
        },
      },
      _count: {
        select: {
          responses: true,
        },
      },
    },
  });

  const ghqWaves = waves.filter(
    (wave) =>
      wave.survey.instrumentCode === SurveyInstrumentCode.GHQ28 ||
      isGhq28SurveyTitle(wave.survey.title)
  );

  const availableRounds = ghqWaves.map((wave) =>
    serializeRoundInfo({
      id: wave.id,
      title: `${wave.survey.title} — ${wave.label}`,
      startsAt: wave.opensAt,
      responseCount: wave._count.responses,
    })
  );

  // รองรับ client เก่าที่ส่ง surveyId — map เป็นคลื่นล่าสุดของแบบนั้น
  const resolveRoundId = (requestedId: string | undefined): string | undefined => {
    if (!requestedId) {
      return undefined;
    }
    if (availableRounds.some((round) => round.id === requestedId)) {
      return requestedId;
    }
    const legacyWave = ghqWaves
      .filter((wave) => wave.surveyId === requestedId)
      .sort((a, b) => b.opensAt.getTime() - a.opensAt.getTime())[0];
    return legacyWave?.id;
  };

  let round1Info: ScreeningRoundInfo | null = null;
  let round2Info: ScreeningRoundInfo | null = null;

  if (input?.fromSurveyId && input?.toSurveyId) {
    const fromId = resolveRoundId(input.fromSurveyId);
    const toId = resolveRoundId(input.toSurveyId);
    round1Info = availableRounds.find((round) => round.id === fromId) ?? null;
    round2Info = availableRounds.find((round) => round.id === toId) ?? null;
  } else {
    const defaults = pickDefaultRounds(availableRounds);
    round1Info = defaults.round1;
    round2Info = defaults.round2;
  }

  if (!round1Info || !round2Info) {
    return {
      generatedAt: new Date().toISOString(),
      availableRounds,
      round1: round1Info,
      round2: round2Info,
      summary: buildScreeningComparisonSummary([]),
      rows: [],
    };
  }

  const round1Wave = ghqWaves.find((wave) => wave.id === round1Info.id);
  const round2Wave = ghqWaves.find((wave) => wave.id === round2Info.id);

  if (!round1Wave || !round2Wave) {
    return {
      generatedAt: new Date().toISOString(),
      availableRounds,
      round1: round1Info,
      round2: round2Info,
      summary: buildScreeningComparisonSummary([]),
      rows: [],
    };
  }

  const [round1Responses, round2Responses] = await Promise.all([
    prisma.surveyResponse.findMany({
      where: { waveId: round1Wave.id },
      include: {
        answers: true,
        student: {
          select: {
            id: true,
            studentId: true,
            studyYear: true,
            section: true,
          },
        },
      },
    }),
    prisma.surveyResponse.findMany({
      where: { waveId: round2Wave.id },
      include: {
        answers: true,
        student: {
          select: {
            id: true,
            studentId: true,
            studyYear: true,
            section: true,
          },
        },
      },
    }),
  ]);

  const round1ByStudentId = new Map<string, ResponseScore>();
  const students = new Map<string, StudentInfo>();

  round1Responses.forEach((response) => {
    round1ByStudentId.set(
      response.studentId,
      resolveResponseScore(round1Wave.survey, response)
    );
    students.set(response.studentId, {
      studentCode: formatStudentIdForResponse(response.student.studentId) ?? response.studentId,
      studyYear: normalizeStudyYearKey(response.student.studyYear),
      section: response.student.section,
    });
  });

  const round2ByStudentId = new Map<string, ResponseScore>();
  round2Responses.forEach((response) => {
    round2ByStudentId.set(
      response.studentId,
      resolveResponseScore(round2Wave.survey, response)
    );
    if (!students.has(response.studentId)) {
      students.set(response.studentId, {
        studentCode: formatStudentIdForResponse(response.student.studentId) ?? response.studentId,
        studyYear: normalizeStudyYearKey(response.student.studyYear),
        section: response.student.section,
      });
    }
  });

  const rows = buildScreeningComparisonRows({
    round1Responses: round1ByStudentId,
    round2Responses: round2ByStudentId,
    students,
    filterStudyYear: studyYearFilter,
  });

  return {
    generatedAt: new Date().toISOString(),
    availableRounds,
    round1: round1Info,
    round2: round2Info,
    summary: buildScreeningComparisonSummary(rows),
    rows,
  };
};
