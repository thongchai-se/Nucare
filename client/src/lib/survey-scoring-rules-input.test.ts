import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildScoringRulesFromInputs,
  convertCutoffInput,
  parseCutoffInput,
  pickLatestVersion,
  SCORING_NOTE_MAX_LENGTH,
} from "./survey-scoring-rules-input";

describe("client survey-scoring-rules-input", () => {
  it("parseCutoffInput: ว่างคืน null และ ratio/percent แปลงเป็นสัดส่วน", () => {
    assert.deepEqual(parseCutoffInput("  ", "ratio"), { ok: true, value: null });
    assert.deepEqual(parseCutoffInput("0.5", "ratio"), { ok: true, value: 0.5 });
    assert.deepEqual(parseCutoffInput("34", "percent"), { ok: true, value: 0.34 });
    assert.deepEqual(parseCutoffInput("67", "percent"), { ok: true, value: 0.67 });
    assert.deepEqual(parseCutoffInput("100", "percent"), { ok: true, value: 1 });
  });

  it("parseCutoffInput: ปฏิเสธค่านอกช่วงและข้อความที่ไม่ใช่ตัวเลข", () => {
    for (const raw of ["0", "-0.1", "1.5", "abc", "1e-1", "0.5%", "--1"]) {
      assert.deepEqual(parseCutoffInput(raw, "ratio"), { ok: false }, raw);
    }
    assert.deepEqual(parseCutoffInput("101", "percent"), { ok: false });
    assert.deepEqual(parseCutoffInput("0", "percent"), { ok: false });
  });

  it("buildScoringRulesFromInputs: ว่างทั้งหมดคืน undefined (สืบทอดกฎเดิม)", () => {
    assert.deepEqual(buildScoringRulesFromInputs({ medium: "", high: "", note: "", mode: "ratio" }), {
      ok: true,
      scoringRules: undefined,
    });
  });

  it("buildScoringRulesFromInputs: ส่ง riskCutoffs และ note ที่ trim แล้ว", () => {
    assert.deepEqual(
      buildScoringRulesFromInputs({ medium: "40", high: "70", note: "  เกณฑ์ที่คณะอนุมัติ  ", mode: "percent" }),
      {
        ok: true,
        scoringRules: { riskCutoffs: { medium: 0.4, high: 0.7 }, note: "เกณฑ์ที่คณะอนุมัติ" },
      }
    );
    assert.deepEqual(buildScoringRulesFromInputs({ medium: "0.5", high: "0.8", note: "", mode: "ratio" }), {
      ok: true,
      scoringRules: { riskCutoffs: { medium: 0.5, high: 0.8 } },
    });
  });

  it("buildScoringRulesFromInputs: กรอกไม่ครบคู่ หรือ medium >= high ถูกปฏิเสธ", () => {
    assert.equal(
      buildScoringRulesFromInputs({ medium: "0.5", high: "", note: "", mode: "ratio" }).ok,
      false
    );
    assert.equal(
      buildScoringRulesFromInputs({ medium: "", high: "0.5", note: "", mode: "ratio" }).ok,
      false
    );
    assert.equal(
      buildScoringRulesFromInputs({ medium: "0.7", high: "0.7", note: "", mode: "ratio" }).ok,
      false
    );
    assert.equal(
      buildScoringRulesFromInputs({ medium: "80", high: "50", note: "", mode: "percent" }).ok,
      false
    );
  });

  it("buildScoringRulesFromInputs: ค่านอกช่วงและ note ยาวเกินถูกปฏิเสธ", () => {
    assert.equal(
      buildScoringRulesFromInputs({ medium: "0.5", high: "1.5", note: "", mode: "ratio" }).ok,
      false
    );
    assert.equal(
      buildScoringRulesFromInputs({
        medium: "",
        high: "",
        note: "ก".repeat(SCORING_NOTE_MAX_LENGTH + 1),
        mode: "ratio",
      }).ok,
      false
    );
  });

  it("convertCutoffInput: สลับหน่วยโดยรักษาค่า และค่าผิดถูกล้าง", () => {
    assert.equal(convertCutoffInput("0.34", "ratio", "percent"), "34");
    assert.equal(convertCutoffInput("67", "percent", "ratio"), "0.67");
    assert.equal(convertCutoffInput("", "ratio", "percent"), "");
    assert.equal(convertCutoffInput("abc", "ratio", "percent"), "");
    assert.equal(convertCutoffInput("0.5", "ratio", "ratio"), "0.5");
  });

  it("pickLatestVersion: เลือกเลขสูงสุดโดยไม่ขึ้นกับลำดับ และรายการว่างคืน null", () => {
    assert.equal(pickLatestVersion([]), null);
    assert.equal(pickLatestVersion([{ version: 2 }, { version: 5 }, { version: 3 }])?.version, 5);
  });
});
