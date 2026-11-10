import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasCrisisWellnessSignal, type StudentWellnessSignalDto } from "./student-wellness-summary";

const sample = (
  overrides: Partial<StudentWellnessSignalDto> & Pick<StudentWellnessSignalDto, "code">
): StudentWellnessSignalDto => ({
  labelTh: "x",
  shortLabelTh: "x",
  occurrenceCount: 1,
  firstDetectedAt: new Date().toISOString(),
  lastDetectedAt: new Date().toISOString(),
  ...overrides,
});

describe("hasCrisisWellnessSignal", () => {
  it("returns false when no crisis code", () => {
    assert.equal(
      hasCrisisWellnessSignal([sample({ code: "ACADEMIC_STRESS" }), sample({ code: "ANXIETY_THEME" })]),
      false
    );
  });

  it("returns true when SELF_HARM_CRISIS present", () => {
    assert.equal(
      hasCrisisWellnessSignal([sample({ code: "ACADEMIC_STRESS" }), sample({ code: "SELF_HARM_CRISIS" })]),
      true
    );
  });
});
