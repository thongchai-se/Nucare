import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isScheduleAtOnOrAfterNow,
  localDateInputValue,
  localDatetimeInputValue,
  scheduleDateInputMin,
  scheduleDatetimeInputMin,
} from "./schedule-datetime";

describe("schedule-datetime helpers", () => {
  it("SDT-01 จัดรูปแบบวันที่/วันเวลาท้องถิ่นสำหรับ input", () => {
    const sample = new Date(2026, 10, 15, 18, 59, 0);
    assert.equal(localDateInputValue(sample), "2026-11-15");
    assert.equal(localDatetimeInputValue(sample), "2026-11-15T18:59");
    assert.equal(scheduleDateInputMin(sample), "2026-11-15");
    assert.equal(scheduleDatetimeInputMin(sample), "2026-11-15T18:59");
  });

  it("SDT-02 กันเลือกเวลาย้อนหลังโดยเผื่อ clock skew", () => {
    const now = new Date("2026-11-15T12:00:00.000Z");
    assert.equal(isScheduleAtOnOrAfterNow(new Date("2026-11-15T12:00:00.000Z"), now), true);
    assert.equal(isScheduleAtOnOrAfterNow(new Date("2026-11-15T11:59:50.000Z"), now), true);
    assert.equal(isScheduleAtOnOrAfterNow(new Date("2026-11-15T11:00:00.000Z"), now), false);
  });
});
