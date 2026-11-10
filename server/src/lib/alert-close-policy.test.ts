import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAlertCloseData } from "./alert-close-policy";

describe("resolveAlertCloseData", () => {
  const now = new Date("2026-10-29T12:00:00.000Z");

  it("dismiss_signal closes without acknowledging", () => {
    const result = resolveAlertCloseData({
      mode: "dismiss_signal",
      alreadyAcknowledged: false,
      now,
    });

    assert.equal(result.allowed, true);
    if (!result.allowed) return;
    assert.equal(result.closedAt.toISOString(), now.toISOString());
    assert.equal(result.acknowledgedAt, undefined);
    assert.equal(result.auditAction, "alerts.dismiss");
    assert.match(result.auditDescription, /ไม่ถือว่ารับเรื่อง/);
  });

  it("follow_up rejects close when still not acknowledged", () => {
    const result = resolveAlertCloseData({
      mode: "follow_up",
      alreadyAcknowledged: false,
      resolutionNote: "ติดตามครบแล้ว",
      now,
    });

    assert.equal(result.allowed, false);
    if (result.allowed) return;
    assert.equal(result.code, "MUST_ACKNOWLEDGE");
    assert.match(result.message, /รับเรื่องก่อน/);
  });

  it("follow_up closes after acknowledge without rewriting acknowledgedAt", () => {
    const result = resolveAlertCloseData({
      mode: "follow_up",
      alreadyAcknowledged: true,
      resolutionNote: "พูดคุยแล้ว",
      now,
    });

    assert.equal(result.allowed, true);
    if (!result.allowed) return;
    assert.equal(result.closedAt.toISOString(), now.toISOString());
    assert.equal(result.acknowledgedAt, undefined);
    assert.equal(result.resolutionNote, "พูดคุยแล้ว");
    assert.equal(result.auditAction, "alerts.close");
  });
});
