import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RiskLevel, SurveyInstrumentCode, SurveyWaveStatus } from "@prisma/client";
import {
  buildScreeningOverviewRoundPoint,
  buildScreeningOverviewSeries,
  numberOrNullAvg,
} from "./executive-screening-overview";

describe("executive screening overview", () => {
  it("ESO-01 numberOrNullAvg returns null when empty", () => {
    assert.equal(numberOrNullAvg(0, 0), null);
    assert.equal(numberOrNullAvg(12, 2), 6);
  });

  it("ESO-02 buildScreeningOverviewRoundPoint aggregates scores and risk by year", () => {
    const point = buildScreeningOverviewRoundPoint({
      id: "w1",
      surveyId: "s1",
      label: "รอบ 1",
      opensAt: new Date("2026-01-10T00:00:00.000Z"),
      closesAt: null,
      status: SurveyWaveStatus.OPEN,
      surveyTitle: "GHQ-28",
      instrumentCode: SurveyInstrumentCode.GHQ28,
      assignments: [{ completedAt: new Date() }, { completedAt: null }, { completedAt: null }],
      responses: [
        { totalScore: 10, riskLevel: RiskLevel.NORMAL, studyYear: 1 },
        { totalScore: 20, riskLevel: RiskLevel.HIGH, studyYear: 1 },
        { totalScore: 15, riskLevel: RiskLevel.MEDIUM, studyYear: 2 },
      ],
    });

    assert.equal(point.responseCount, 3);
    assert.equal(point.avgScore, 15);
    assert.equal(point.highRiskCount, 1);
    assert.equal(point.mediumRiskCount, 1);
    assert.equal(point.normalRiskCount, 1);
    assert.equal(point.completionPercent, 33);
    assert.equal(point.byStudyYear["1"].responseCount, 2);
    assert.equal(point.byStudyYear["1"].avgScore, 15);
    assert.equal(point.byStudyYear["1"].highRiskCount, 1);
    assert.equal(point.byStudyYear["2"].avgScore, 15);
  });

  it("ESO-03 buildScreeningOverviewSeries builds overlay-ready arrays", () => {
    const round1 = buildScreeningOverviewRoundPoint({
      id: "w1",
      surveyId: "s1",
      label: "รอบ 1",
      opensAt: new Date("2026-01-10T00:00:00.000Z"),
      closesAt: null,
      status: SurveyWaveStatus.OPEN,
      surveyTitle: "GHQ-28",
      instrumentCode: SurveyInstrumentCode.GHQ28,
      assignments: [{ completedAt: new Date() }],
      responses: [{ totalScore: 10, riskLevel: RiskLevel.NORMAL, studyYear: 1 }],
    });
    const round2 = buildScreeningOverviewRoundPoint({
      id: "w2",
      surveyId: "s1",
      label: "รอบ 2",
      opensAt: new Date("2026-06-10T00:00:00.000Z"),
      closesAt: null,
      status: SurveyWaveStatus.OPEN,
      surveyTitle: "GHQ-28",
      instrumentCode: SurveyInstrumentCode.GHQ28,
      assignments: [{ completedAt: new Date() }, { completedAt: null }],
      responses: [
        { totalScore: 18, riskLevel: RiskLevel.HIGH, studyYear: 1 },
        { totalScore: 12, riskLevel: RiskLevel.NORMAL, studyYear: 3 },
      ],
    });

    const series = buildScreeningOverviewSeries([round1, round2], "ALL");
    assert.equal(series.labels.length, 2);
    assert.deepEqual(series.avgScoreOverall, [10, 15]);
    assert.deepEqual(series.highRiskOverall, [0, 1]);
    assert.deepEqual(series.avgScoreByYear["1"], [10, 18]);
    assert.deepEqual(series.highRiskByYear["1"], [0, 1]);
    assert.equal(series.completionOverall[0], 100);
    assert.equal(series.completionOverall[1], 50);
  });
});
