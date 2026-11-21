import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowCriticalSecurityPopup } from "./security-critical-ack";

describe("security critical ack", () => {
  it("SCA-01 โชว์ popup เมื่อมี CRITICAL ใน 24 ชม. และยังไม่ ack", () => {
    const now = Date.parse("2026-11-21T00:00:00.000Z");
    const result = shouldShowCriticalSecurityPopup({
      nowMs: now,
      ackTimestampMs: null,
      logs: [
        {
          action: "security.privilege-probe",
          createdAt: "2026-11-20T20:00:00.000Z",
        },
      ],
    });
    assert.equal(result.show, true);
  });

  it("SCA-02 ไม่โชว์เมื่อ ack แล้วเท่าหรือใหม่กว่าเหตุ", () => {
    const eventAt = Date.parse("2026-11-20T20:00:00.000Z");
    const result = shouldShowCriticalSecurityPopup({
      nowMs: Date.parse("2026-11-21T00:00:00.000Z"),
      ackTimestampMs: eventAt,
      logs: [
        {
          action: "security.privilege-probe",
          createdAt: "2026-11-20T20:00:00.000Z",
        },
      ],
    });
    assert.equal(result.show, false);
  });

  it("SCA-03 ไม่โชว์ MEDIUM เป็น popup วิกฤต", () => {
    const result = shouldShowCriticalSecurityPopup({
      nowMs: Date.parse("2026-11-21T00:00:00.000Z"),
      ackTimestampMs: null,
      logs: [
        {
          action: "auth.login.failed",
          createdAt: "2026-11-20T23:00:00.000Z",
        },
      ],
    });
    assert.equal(result.show, false);
  });
});
