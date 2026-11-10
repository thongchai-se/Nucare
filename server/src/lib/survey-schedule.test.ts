import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildNextWaveDraft,
  resolveScheduleIntervalDays,
  scheduleIntervalToDays,
  validateCustomSchedule,
} from "./survey-schedule";

describe("survey-schedule helpers", () => {
  it("converts custom units to days", () => {
    assert.equal(scheduleIntervalToDays(3, "DAYS"), 3);
    assert.equal(scheduleIntervalToDays(2, "WEEKS"), 14);
    assert.equal(scheduleIntervalToDays(1, "MONTHS"), 30);
    assert.equal(scheduleIntervalToDays(0, "DAYS"), null);
  });

  it("resolves interval from frequency presets", () => {
    assert.equal(
      resolveScheduleIntervalDays({ frequency: "ONE_SHOT", scheduleEvery: null, scheduleUnit: null }),
      null
    );
    assert.equal(
      resolveScheduleIntervalDays({ frequency: "WEEKLY", scheduleEvery: null, scheduleUnit: null }),
      7
    );
    assert.equal(
      resolveScheduleIntervalDays({
        frequency: "CUSTOM_INTERVAL",
        scheduleEvery: 10,
        scheduleUnit: "DAYS",
      }),
      10
    );
  });

  it("requires complete custom schedule values", () => {
    assert.equal(
      validateCustomSchedule({ frequency: "ONE_SHOT", scheduleEvery: null, scheduleUnit: null }),
      null
    );
    assert.match(
      validateCustomSchedule({
        frequency: "CUSTOM_INTERVAL",
        scheduleEvery: null,
        scheduleUnit: "DAYS",
      }) || "",
      /1–365/
    );
    assert.match(
      validateCustomSchedule({
        frequency: "CUSTOM_INTERVAL",
        scheduleEvery: 5,
        scheduleUnit: null,
      }) || "",
      /หน่วย/
    );
  });

  it("builds next wave draft from last open without inventing distant future by default", () => {
    const now = new Date("2026-10-29T08:00:00.000Z");
    const draft = buildNextWaveDraft({
      frequency: "CUSTOM_INTERVAL",
      scheduleEvery: 14,
      scheduleUnit: "DAYS",
      now,
      lastOpensAt: new Date("2026-10-01T08:00:00.000Z"),
    });

    assert.equal(draft.opensAt.toISOString(), now.toISOString());
    assert.ok(draft.closesAt);
    assert.match(draft.label, /ทุก 14 วัน/);
  });

  it("suggests academic term label and longer open window", () => {
    const draft = buildNextWaveDraft({
      frequency: "ACADEMIC_TERM",
      scheduleEvery: null,
      scheduleUnit: null,
      now: new Date("2026-06-01T01:00:00.000Z"),
      termKey: "1/2569",
    });

    assert.equal(draft.termKey, "1/2569");
    assert.equal(draft.label, "1/2569");
    assert.ok(draft.closesAt);
  });
});
