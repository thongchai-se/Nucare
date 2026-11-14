import type { ExecutiveYearFilter } from "@/types/executive";

export type ScreeningOverviewStudyYearKey = "1" | "2" | "3" | "4";

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
  assignmentSummary: {
    assignedCount: number;
    completedCount: number;
    pendingCount: number;
    overdueCount: number;
  };
  byStudyYear: Record<
    ScreeningOverviewStudyYearKey,
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
  avgScoreByYear: Record<ScreeningOverviewStudyYearKey, Array<number | null>>;
  highRiskByYear: Record<ScreeningOverviewStudyYearKey, number[]>;
};

export type ScreeningOverviewInstrumentOption = {
  code: string;
  label: string;
};

export type ScreeningOverviewResponse = {
  generatedAt: string;
  instrumentCode: string;
  instrumentLabel: string;
  availableInstruments: ScreeningOverviewInstrumentOption[];
  rounds: ScreeningOverviewRoundPoint[];
  series: ScreeningOverviewSeries;
};

export type ScreeningOverviewYearFilter = ExecutiveYearFilter;
