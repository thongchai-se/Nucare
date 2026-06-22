import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildScreeningComparisonRows,
  buildScreeningComparisonSummary,
  formatDistressChange,
} from "./executive-screening-comparison";

describe("executive screening comparison", () => {
  it("ESC-01 buildScreeningComparisonRows computes delta for students in both rounds", () => {
    const round1 = new Map([
      [
        "s1",
        {
          score: 20,
          distressLabel: "ปัญหาสุขภาพจิตระดับน้อย (Mild Distress)",
          submittedAt: new Date("2026-01-10"),
        },
      ],
      [
        "s2",
        {
          score: 10,
          distressLabel: "ไม่มีปัญหาสุขภาพจิต (Normal)",
          submittedAt: new Date("2026-01-10"),
        },
      ],
    ]);

    const round2 = new Map([
      [
        "s1",
        {
          score: 15,
          distressLabel: "ปัญหาสุขภาพจิตระดับน้อย (Mild Distress)",
          submittedAt: new Date("2026-06-10"),
        },
      ],
    ]);

    const students = new Map([
      ["s1", { studentCode: "663380696-6", studyYear: 2, section: "A" }],
      ["s2", { studentCode: "663380697-4", studyYear: 1, section: "B" }],
    ]);

    const rows = buildScreeningComparisonRows({
      round1Responses: round1,
      round2Responses: round2,
      students,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.studentCode, "663380696-6");
    assert.equal(rows[0]?.round1.score, 20);
    assert.equal(rows[0]?.round2.score, 15);
    assert.equal(rows[0]?.deltaScore, -5);
    assert.equal(rows[0]?.distressChange, null);
  });

  it("ESC-02 excludes students with only one round", () => {
    const round1 = new Map([
      [
        "s2",
        {
          score: 10,
          distressLabel: "ไม่มีปัญหาสุขภาพจิต (Normal)",
          submittedAt: new Date("2026-01-10"),
        },
      ],
    ]);

    const round2 = new Map([
      [
        "s1",
        {
          score: 15,
          distressLabel: "ปัญหาสุขภาพจิตระดับน้อย (Mild Distress)",
          submittedAt: new Date("2026-06-10"),
        },
      ],
    ]);

    const students = new Map([
      ["s1", { studentCode: "663380696-6", studyYear: 2, section: "A" }],
      ["s2", { studentCode: "663380697-4", studyYear: 1, section: "B" }],
    ]);

    const rows = buildScreeningComparisonRows({
      round1Responses: round1,
      round2Responses: round2,
      students,
    });

    assert.equal(rows.length, 0);
  });

  it("ESC-03 filters rows by study year", () => {
    const submittedAt = new Date("2026-01-10");
    const round1 = new Map([
      ["s1", { score: 20, distressLabel: "Mild", submittedAt }],
      ["s2", { score: 18, distressLabel: "Mild", submittedAt }],
    ]);
    const round2 = new Map([
      ["s1", { score: 15, distressLabel: "Mild", submittedAt }],
      ["s2", { score: 12, distressLabel: "Normal", submittedAt }],
    ]);
    const students = new Map([
      ["s1", { studentCode: "663380696-6", studyYear: 2, section: "A" }],
      ["s2", { studentCode: "663380697-4", studyYear: 1, section: "B" }],
    ]);

    const rows = buildScreeningComparisonRows({
      round1Responses: round1,
      round2Responses: round2,
      students,
      filterStudyYear: 2,
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.studyYear, 2);
  });

  it("ESC-04 buildScreeningComparisonSummary aggregates improved/worsened counts", () => {
    const rows = [
      {
        studentCode: "a",
        studyYear: 1,
        section: "A",
        round1: { score: 20, distressLabel: "Mild", submittedAt: "2026-01-01" },
        round2: { score: 15, distressLabel: "Mild", submittedAt: "2026-06-01" },
        deltaScore: -5,
        distressChange: null,
      },
      {
        studentCode: "b",
        studyYear: 1,
        section: "A",
        round1: { score: 10, distressLabel: "Normal", submittedAt: "2026-01-01" },
        round2: { score: 25, distressLabel: "Moderate", submittedAt: "2026-06-01" },
        deltaScore: 15,
        distressChange: "Normal → Moderate",
      },
      {
        studentCode: "c",
        studyYear: 1,
        section: "A",
        round1: { score: 12, distressLabel: "Normal", submittedAt: "2026-01-01" },
        round2: { score: 12, distressLabel: "Normal", submittedAt: "2026-06-01" },
        deltaScore: 0,
        distressChange: null,
      },
    ];

    const summary = buildScreeningComparisonSummary(rows);

    assert.equal(summary.comparedCount, 3);
    assert.equal(summary.improvedCount, 1);
    assert.equal(summary.worsenedCount, 1);
    assert.equal(summary.unchangedCount, 1);
    assert.equal(summary.avgRound1Score, 14);
    assert.equal(summary.avgRound2Score, 17.3);
    assert.equal(summary.avgDelta, 3.3);
  });

  it("ESC-05 formatDistressChange returns arrow label when levels differ", () => {
    assert.equal(formatDistressChange("Normal", "Mild"), "Normal → Mild");
    assert.equal(formatDistressChange("Mild", "Mild"), null);
  });
});
