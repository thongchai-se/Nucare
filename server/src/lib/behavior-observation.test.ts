import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canReportObservationAboutStudent,
  OBSERVATION_RECORD_LIST_MAX,
  OBSERVATION_STUDENT_SEARCH_MAX,
} from "./behavior-observation";

describe("behavior observation limits", () => {
  it("keeps student search bounded for advisor directory lookups", () => {
    assert.equal(OBSERVATION_STUDENT_SEARCH_MAX, 50);
    assert.ok(OBSERVATION_STUDENT_SEARCH_MAX <= 100);
  });

  it("keeps reporter history list bounded", () => {
    assert.equal(OBSERVATION_RECORD_LIST_MAX, 300);
    assert.ok(OBSERVATION_RECORD_LIST_MAX <= 500);
  });
});

describe("observation own-advisee rule", () => {
  it("BO-01 ห้ามแจ้งข้อสังเกตนิสิตในสังกัดตัวเอง", () => {
    assert.equal(canReportObservationAboutStudent(true), false);
    assert.equal(canReportObservationAboutStudent(false), true);
  });
});
