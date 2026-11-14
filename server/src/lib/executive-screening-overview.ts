import {
  RiskLevel,
  SurveyInstrumentCode,
  SurveyStatus,
  type SurveyWaveStatus,
} from "@prisma/client";
import { normalizeStudyYearKey } from "./executive-analytics";
import {
  buildWaveAssignmentSummary,
  type ScreeningRoundAssignmentSummary,
} from "./executive-screening-comparison";
import { isGhq28SurveyTitle } from "./survey-scoring";
import { prisma } from "./prisma";
import { MAX_STUDY_YEAR, MIN_STUDY_YEAR } from "./study-year";

export type StudyYearKey = "1" | "2" | "3" | "4";

export type ScreeningOverviewRoundPoint = {
  waveId: string;
  surveyId: string;
  label: string;
  startsAt: string | null;
  responseCount: number;
  avgScore: number | null;
  completionPercent: number;
  highRiskCount: number;
  mediumRiskCount: number;
  normalRiskCount: number;
  assignmentSummary: ScreeningRoundAssignmentSummary;
  byStudyYear: Record<
    StudyYearKey,
    {
      responseCount: number;
      avgScore: number | null;
      highRiskCount: number;
    }
  >;
};

export type ScreeningOverviewSeries = {
  labels: string[];
  avgScoreOverall: Array<number | null>;
  completionOverall: number[];
  highRiskOverall: number[];
  avgScoreByYear: Record<StudyYearKey, Array<number | null>>;
  highRiskByYear: Record<StudyYearKey, number[]>;
};

export type ScreeningOverviewInstrumentOption = {
  code: string;
  label: string;
};

export type ScreeningOverviewPayload = {
  generatedAt: string;
  instrumentCode: string;
  instrumentLabel: string;
  availableInstruments: ScreeningOverviewInstrumentOption[];
  rounds: ScreeningOverviewRoundPoint[];
  series: ScreeningOverviewSeries;
};

export type StudyYearOverviewFilter = number | null | "ALL";

const STUDY_YEAR_KEYS: StudyYearKey[] = ["1", "2", "3", "4"];

/** คำนวณค่าเฉลี่ยทศนิยม 1 ตำแหน่ง หรือ null เมื่อไม่มีคะแนน */
export function numberOrNullAvg(sum: number, count: number): number | null {
  if (count <= 0) {
    return null;
  }
  return Math.round((sum / count) * 10) / 10;
}

/** สร้างถังว่างตามชั้นปี 1–4 สำหรับสะสมคะแนนรายรอบ */
export function createEmptyYearBuckets(): Record<
  StudyYearKey,
  { responseCount: number; scoreSum: number; scoreCount: number; highRiskCount: number }
> {
  return {
    "1": { responseCount: 0, scoreSum: 0, scoreCount: 0, highRiskCount: 0 },
    "2": { responseCount: 0, scoreSum: 0, scoreCount: 0, highRiskCount: 0 },
    "3": { responseCount: 0, scoreSum: 0, scoreCount: 0, highRiskCount: 0 },
    "4": { responseCount: 0, scoreSum: 0, scoreCount: 0, highRiskCount: 0 },
  };
}

type ResponseFixture = {
  totalScore: number | null;
  riskLevel: RiskLevel;
  studyYear: number | null;
};

type WaveFixture = {
  id: string;
  surveyId: string;
  label: string;
  opensAt: Date | null;
  closesAt: Date | null;
  status: SurveyWaveStatus;
  surveyTitle: string;
  instrumentCode: SurveyInstrumentCode;
  assignments: Array<{ completedAt: Date | null }>;
  responses: ResponseFixture[];
};

/**
 * สรุปจุดข้อมูลรายรอบจากคลื่นและคำตอบ — O(r) เมื่อ r = จำนวนคำตอบในคลื่น
 * ใช้สำหรับกราฟเส้นคะแนนเฉลี่ย/อัตราทำแบบ/เสี่ยงสูง แยกชั้นปี
 */
export function buildScreeningOverviewRoundPoint(
  wave: WaveFixture,
  now: Date = new Date()
): ScreeningOverviewRoundPoint {
  const yearBuckets = createEmptyYearBuckets();
  let scoreSum = 0;
  let scoreCount = 0;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let normalRiskCount = 0;

  for (const response of wave.responses) {
    const yearKey = normalizeStudyYearKey(response.studyYear);
    if (yearKey !== null && yearKey >= MIN_STUDY_YEAR && yearKey <= MAX_STUDY_YEAR) {
      const bucket = yearBuckets[String(yearKey) as StudyYearKey];
      bucket.responseCount += 1;
      if (response.totalScore !== null) {
        bucket.scoreSum += response.totalScore;
        bucket.scoreCount += 1;
      }
      if (response.riskLevel === RiskLevel.HIGH) {
        bucket.highRiskCount += 1;
      }
    }

    if (response.totalScore !== null) {
      scoreSum += response.totalScore;
      scoreCount += 1;
    }
    if (response.riskLevel === RiskLevel.HIGH) {
      highRiskCount += 1;
    } else if (response.riskLevel === RiskLevel.MEDIUM) {
      mediumRiskCount += 1;
    } else {
      normalRiskCount += 1;
    }
  }

  const assignmentSummary = buildWaveAssignmentSummary(
    wave.assignments.map((assignment) => ({
      completedAt: assignment.completedAt,
      closesAt: wave.closesAt,
      waveStatus: wave.status,
    })),
    now
  );

  const completionPercent =
    assignmentSummary.assignedCount === 0
      ? 0
      : Math.round((assignmentSummary.completedCount / assignmentSummary.assignedCount) * 100);

  const byStudyYear = STUDY_YEAR_KEYS.reduce(
    (acc, key) => {
      const bucket = yearBuckets[key];
      acc[key] = {
        responseCount: bucket.responseCount,
        avgScore: numberOrNullAvg(bucket.scoreSum, bucket.scoreCount),
        highRiskCount: bucket.highRiskCount,
      };
      return acc;
    },
    {} as ScreeningOverviewRoundPoint["byStudyYear"]
  );

  return {
    waveId: wave.id,
    surveyId: wave.surveyId,
    label: `${wave.surveyTitle} — ${wave.label}`,
    startsAt: wave.opensAt?.toISOString() ?? null,
    responseCount: wave.responses.length,
    avgScore: numberOrNullAvg(scoreSum, scoreCount),
    completionPercent,
    highRiskCount,
    mediumRiskCount,
    normalRiskCount,
    assignmentSummary,
    byStudyYear,
  };
}

/** ประกอบชุดข้อมูลกราฟเส้นจากรายการรอบ — O(n) เมื่อ n = จำนวนรอบ */
export function buildScreeningOverviewSeries(
  rounds: ScreeningOverviewRoundPoint[],
  studyYearFilter: StudyYearOverviewFilter = "ALL"
): ScreeningOverviewSeries {
  const labels = rounds.map((round) => {
    if (!round.startsAt) {
      return round.label;
    }
    return new Intl.DateTimeFormat("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    }).format(new Date(round.startsAt));
  });

  const avgScoreByYear = {
    "1": [] as Array<number | null>,
    "2": [] as Array<number | null>,
    "3": [] as Array<number | null>,
    "4": [] as Array<number | null>,
  };
  const highRiskByYear = {
    "1": [] as number[],
    "2": [] as number[],
    "3": [] as number[],
    "4": [] as number[],
  };

  const avgScoreOverall: Array<number | null> = [];
  const completionOverall: number[] = [];
  const highRiskOverall: number[] = [];

  for (const round of rounds) {
    if (studyYearFilter === "ALL") {
      avgScoreOverall.push(round.avgScore);
      completionOverall.push(round.completionPercent);
      highRiskOverall.push(round.highRiskCount);
    } else {
      const key = String(studyYearFilter) as StudyYearKey;
      const yearPoint = round.byStudyYear[key];
      avgScoreOverall.push(yearPoint?.avgScore ?? null);
      const assigned = round.assignmentSummary.assignedCount;
      // เมื่อกรองชั้นปี ใช้อัตราตอบจากจำนวนคำตอบในชั้นนั้นเทียบกับมอบหมายทั้งคลื่นเป็น proxy
      completionOverall.push(
        assigned === 0 ? 0 : Math.round(((yearPoint?.responseCount ?? 0) / assigned) * 100)
      );
      highRiskOverall.push(yearPoint?.highRiskCount ?? 0);
    }

    for (const key of STUDY_YEAR_KEYS) {
      avgScoreByYear[key].push(round.byStudyYear[key].avgScore);
      highRiskByYear[key].push(round.byStudyYear[key].highRiskCount);
    }
  }

  return {
    labels,
    avgScoreOverall,
    completionOverall,
    highRiskOverall,
    avgScoreByYear,
    highRiskByYear,
  };
}

const resolveEffectiveInstrumentCode = (survey: {
  instrumentCode: SurveyInstrumentCode;
  title: string;
}): SurveyInstrumentCode =>
  survey.instrumentCode === SurveyInstrumentCode.GHQ28 || isGhq28SurveyTitle(survey.title)
    ? SurveyInstrumentCode.GHQ28
    : SurveyInstrumentCode.CUSTOM;

/** ดึงสรุปคะแนนรายรอบสำหรับกราฟภาพรวมผู้บริหาร */
export async function buildExecutiveScreeningOverview(input?: {
  studyYear?: StudyYearOverviewFilter;
  instrumentCode?: string;
}): Promise<ScreeningOverviewPayload> {
  const studyYearFilter = input?.studyYear ?? "ALL";
  const requestedInstrument = input?.instrumentCode?.trim() || SurveyInstrumentCode.GHQ28;
  const now = new Date();

  const waves = await prisma.surveyWave.findMany({
    where: {
      survey: {
        status: SurveyStatus.PUBLISHED,
      },
    },
    orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
    include: {
      survey: {
        select: {
          id: true,
          title: true,
          instrumentCode: true,
        },
      },
      assignments: {
        select: {
          completedAt: true,
        },
      },
      responses: {
        select: {
          totalScore: true,
          riskLevel: true,
          student: {
            select: {
              studyYear: true,
            },
          },
        },
      },
    },
  });

  const instrumentMap = new Map<string, ScreeningOverviewInstrumentOption>();
  for (const wave of waves) {
    const code = resolveEffectiveInstrumentCode(wave.survey);
    if (code === SurveyInstrumentCode.GHQ28) {
      instrumentMap.set(SurveyInstrumentCode.GHQ28, {
        code: SurveyInstrumentCode.GHQ28,
        label: "GHQ-28",
      });
    } else {
      const customCode = `CUSTOM:${wave.surveyId}`;
      if (!instrumentMap.has(customCode)) {
        instrumentMap.set(customCode, {
          code: customCode,
          label: wave.survey.title,
        });
      }
      if (!instrumentMap.has(SurveyInstrumentCode.CUSTOM)) {
        instrumentMap.set(SurveyInstrumentCode.CUSTOM, {
          code: SurveyInstrumentCode.CUSTOM,
          label: "แบบประเมินกำหนดเอง (รวม)",
        });
      }
    }
  }

  if (!instrumentMap.has(SurveyInstrumentCode.GHQ28)) {
    instrumentMap.set(SurveyInstrumentCode.GHQ28, {
      code: SurveyInstrumentCode.GHQ28,
      label: "GHQ-28",
    });
  }

  const availableInstruments = [...instrumentMap.values()].sort((left, right) =>
    left.label.localeCompare(right.label, "th")
  );

  const instrumentWaves = waves.filter((wave) => {
    const effective = resolveEffectiveInstrumentCode(wave.survey);
    const requested = requestedInstrument.toUpperCase();
    if (requested === SurveyInstrumentCode.GHQ28) {
      return effective === SurveyInstrumentCode.GHQ28;
    }
    if (requested === SurveyInstrumentCode.CUSTOM) {
      return effective === SurveyInstrumentCode.CUSTOM;
    }
    if (requested.startsWith("CUSTOM:")) {
      return wave.surveyId === requestedInstrument.replace(/^CUSTOM:/i, "");
    }
    return wave.surveyId === requestedInstrument;
  });

  const rounds = instrumentWaves.map((wave) =>
    buildScreeningOverviewRoundPoint(
      {
        id: wave.id,
        surveyId: wave.surveyId,
        label: wave.label,
        opensAt: wave.opensAt,
        closesAt: wave.closesAt,
        status: wave.status,
        surveyTitle: wave.survey.title,
        instrumentCode: resolveEffectiveInstrumentCode(wave.survey),
        assignments: wave.assignments,
        responses: wave.responses.map((response) => ({
          totalScore: response.totalScore,
          riskLevel: response.riskLevel,
          studyYear: response.student.studyYear,
        })),
      },
      now
    )
  );

  const instrumentLabel =
    availableInstruments.find((item) => item.code === requestedInstrument)?.label ??
    (requestedInstrument.toUpperCase() === SurveyInstrumentCode.GHQ28
      ? "GHQ-28"
      : instrumentWaves[0]?.survey.title ?? requestedInstrument);

  return {
    generatedAt: now.toISOString(),
    instrumentCode: requestedInstrument,
    instrumentLabel,
    availableInstruments,
    rounds,
    series: buildScreeningOverviewSeries(rounds, studyYearFilter),
  };
}
