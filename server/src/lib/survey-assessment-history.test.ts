import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RiskLevel,
  SurveyInstrumentCode,
  SurveyWaveStatus,
} from "@prisma/client";
import { buildAssessmentTimelineEntries } from "./survey-assessment-history";

const ghqSurvey = {
  id: "survey-ghq",
  title: "GHQ-28",
  instrumentCode: SurveyInstrumentCode.GHQ28,
};

const customSurvey = {
  id: "survey-custom",
  title: "แบบติดตามการนอน",
  instrumentCode: SurveyInstrumentCode.CUSTOM,
};

describe("student assessment timeline", () => {
  it("SAH-01 merges completed, pending, and overdue rounds chronologically without duplicates", () => {
    const timeline = buildAssessmentTimelineEntries({
      now: new Date("2026-06-20T00:00:00.000Z"),
      responses: [
        {
          id: "response-1",
          waveId: "wave-1",
          totalScore: 12,
          maxScore: 84,
          scorePercent: 14,
          riskLevel: RiskLevel.NORMAL,
          instrument: "GHQ-28",
          submittedAt: new Date("2026-01-05T09:00:00.000Z"),
          survey: ghqSurvey,
          wave: {
            id: "wave-1",
            label: "รอบต้นปี",
            opensAt: new Date("2026-01-01T00:00:00.000Z"),
            closesAt: new Date("2026-01-10T00:00:00.000Z"),
          },
        },
      ],
      assignments: [
        {
          id: "assignment-duplicate",
          waveId: "wave-1",
          completedAt: null,
          wave: {
            id: "wave-1",
            label: "รอบต้นปี",
            opensAt: new Date("2026-01-01T00:00:00.000Z"),
            closesAt: new Date("2026-01-10T00:00:00.000Z"),
            status: SurveyWaveStatus.CLOSED,
            survey: ghqSurvey,
          },
        },
        {
          id: "assignment-overdue",
          waveId: "wave-2",
          completedAt: null,
          wave: {
            id: "wave-2",
            label: "รอบกลางปี",
            opensAt: new Date("2026-05-01T00:00:00.000Z"),
            closesAt: new Date("2026-05-10T00:00:00.000Z"),
            status: SurveyWaveStatus.CLOSED,
            survey: ghqSurvey,
          },
        },
        {
          id: "assignment-pending",
          waveId: "wave-3",
          completedAt: null,
          wave: {
            id: "wave-3",
            label: "รอบปลายปี",
            opensAt: new Date("2026-07-01T00:00:00.000Z"),
            closesAt: new Date("2026-07-10T00:00:00.000Z"),
            status: SurveyWaveStatus.SCHEDULED,
            survey: ghqSurvey,
          },
        },
      ],
    });

    assert.deepEqual(
      timeline.map((entry) => [entry.waveId, entry.status]),
      [
        ["wave-1", "COMPLETED"],
        ["wave-2", "OVERDUE"],
        ["wave-3", "NOT_COMPLETED"],
      ]
    );
    assert.equal(timeline[0]?.totalScore, 12);
    assert.equal(timeline[1]?.submittedAt, null);
  });

  it("SAH-02 filters by instrument code and survey id", () => {
    const assignments = [
      {
        id: "assignment-ghq",
        waveId: "wave-ghq",
        completedAt: null,
        wave: {
          id: "wave-ghq",
          label: "GHQ",
          opensAt: new Date("2026-01-01T00:00:00.000Z"),
          closesAt: null,
          status: SurveyWaveStatus.OPEN,
          survey: ghqSurvey,
        },
      },
      {
        id: "assignment-custom",
        waveId: "wave-custom",
        completedAt: null,
        wave: {
          id: "wave-custom",
          label: "ติดตาม",
          opensAt: new Date("2026-02-01T00:00:00.000Z"),
          closesAt: null,
          status: SurveyWaveStatus.OPEN,
          survey: customSurvey,
        },
      },
    ];

    const ghqOnly = buildAssessmentTimelineEntries({
      responses: [],
      assignments,
      instrumentCode: "GHQ28",
    });
    const customSurveyOnly = buildAssessmentTimelineEntries({
      responses: [],
      assignments,
      instrumentCode: "survey-custom",
    });

    assert.deepEqual(ghqOnly.map((entry) => entry.waveId), ["wave-ghq"]);
    assert.deepEqual(customSurveyOnly.map((entry) => entry.waveId), ["wave-custom"]);
  });

  it("SAH-03 skips assignments marked completed when no response fixture exists", () => {
    const timeline = buildAssessmentTimelineEntries({
      responses: [],
      assignments: [
        {
          id: "assignment-complete",
          waveId: "wave-complete",
          completedAt: new Date("2026-01-02T00:00:00.000Z"),
          wave: {
            id: "wave-complete",
            label: "รอบเสร็จแล้ว",
            opensAt: new Date("2026-01-01T00:00:00.000Z"),
            closesAt: null,
            status: SurveyWaveStatus.OPEN,
            survey: ghqSurvey,
          },
        },
      ],
    });

    assert.deepEqual(timeline, []);
  });
});
