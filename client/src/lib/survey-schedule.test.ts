import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildNextWaveDraft, resolveScheduleIntervalDays, toDateTimeLocalValue } from "./survey-schedule";

describe("client survey-schedule", () => {
  it("resolves weekly and custom intervals", () => {
    assert.equal(
      resolveScheduleIntervalDays({ frequency: "WEEKLY", scheduleEvery: null, scheduleUnit: null }),
      7
    );
    assert.equal(
      resolveScheduleIntervalDays({
        frequency: "CUSTOM_INTERVAL",
        scheduleEvery: 2,
        scheduleUnit: "MONTHS",
      }),
      60
    );
  });

  it("formats datetime-local without UTC shift", () => {
    const value = toDateTimeLocalValue(new Date(2026, 9, 29, 14, 30, 0));
    assert.equal(value, "2026-10-29T14:30");
  });

  it("builds term wave draft with provided term key", () => {
    const draft = buildNextWaveDraft({
      frequency: "ACADEMIC_TERM",
      scheduleEvery: null,
      scheduleUnit: null,
      now: new Date("2026-08-01T00:00:00.000Z"),
      termKey: "1/2569",
    });
    assert.equal(draft.termKey, "1/2569");
    assert.equal(draft.label, "1/2569");
  });
});
