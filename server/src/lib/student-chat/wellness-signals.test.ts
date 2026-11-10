import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectWellnessTrendSignals, WELLNESS_TREND_SIGNAL_META } from "./wellness-signals";

describe("wellness trend signal detection", () => {
  it("WT-01 detects depressive theme without returning message text", () => {
    const codes = detectWellnessTrendSignals("ช่วงนี้ซึมเศร้ามาก ท้อแท้");
    assert.deepEqual(codes, ["DEPRESSIVE_THEME"]);
    assert.equal(WELLNESS_TREND_SIGNAL_META.DEPRESSIVE_THEME.labelTh, "ประเด็นอารมณ์ซึมเศร้า");
  });

  it("WT-02 detects multiple independent themes in one message", () => {
    const codes = detectWellnessTrendSignals("เครียดเรื่องสอบมาก นอนไม่หลับและเหงา");
    assert.deepEqual(codes, ["ACADEMIC_STRESS", "SLEEP_DISTURBANCE", "LONELINESS_ISOLATION"]);
  });

  it("WT-03 detects crisis signal for self-harm language", () => {
    const codes = detectWellnessTrendSignals("รู้สึกอยากตายเลย");
    assert.ok(codes.includes("SELF_HARM_CRISIS"));
  });

  it("WT-04 returns empty for neutral chat", () => {
    assert.deepEqual(detectWellnessTrendSignals("วันนี้อากาศดีจัง"), []);
  });

  it("WT-05 ignores blank input", () => {
    assert.deepEqual(detectWellnessTrendSignals("   "), []);
  });
});
