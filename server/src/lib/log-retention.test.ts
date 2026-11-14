import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LOG_RETENTION_MAX_DAYS,
  LOG_RETENTION_MIN_DAYS,
  resolveLogRetentionCutoff,
  resolveLogRetentionDays,
} from "./log-retention";

describe("log-retention", () => {
  it("clamp ต่ำกว่า 90 วันขึ้นเป็น 90", () => {
    process.env.TRAFFIC_LOG_RETENTION_DAYS = "30";
    assert.equal(resolveLogRetentionDays("TRAFFIC_LOG_RETENTION_DAYS"), LOG_RETENTION_MIN_DAYS);
  });

  it("clamp สูงกว่า 730 วันลงเป็น 730", () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = "9999";
    assert.equal(resolveLogRetentionDays("AUDIT_LOG_RETENTION_DAYS"), LOG_RETENTION_MAX_DAYS);
  });

  it("คำนวณ cutoff ตามจำนวนวัน retention", () => {
    const now = new Date("2026-11-11T12:00:00.000Z");
    const cutoff = resolveLogRetentionCutoff(90, now);
    assert.equal(cutoff.toISOString(), "2026-08-13T12:00:00.000Z");
  });
});
