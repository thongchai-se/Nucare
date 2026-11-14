import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SurveyInstrumentCode, SurveyQuestionType } from "@prisma/client";
import {
  buildDuplicateTitle,
  buildScoringSnapshot,
  isSnapshotCurrent,
  nextVersionNumber,
  serializeVersionQuestionsForPreview,
  SurveyScoringRulesError,
  toSnapshotQuestionRows,
  validateScoringRules,
  type VersionableQuestion,
} from "./survey-versioning";

const question = (id: string, order: number, overrides: Partial<VersionableQuestion> = {}): VersionableQuestion => ({
  id,
  type: SurveyQuestionType.SINGLE_CHOICE,
  prompt: `ข้อ ${order}`,
  description: null,
  isRequired: true,
  order,
  options: [
    { label: "น้อย", value: "a", score: 0 },
    { label: "มาก", value: "b", score: 3 },
  ],
  minValue: null,
  maxValue: null,
  ...overrides,
});

describe("nextVersionNumber", () => {
  it("starts at 1 when no versions exist", () => {
    assert.equal(nextVersionNumber([]), 1);
  });

  it("returns max + 1 regardless of order or gaps", () => {
    assert.equal(nextVersionNumber([1, 2, 3]), 4);
    assert.equal(nextVersionNumber([3, 1]), 4);
    assert.equal(nextVersionNumber([1, 5]), 6);
  });
});

describe("validateScoringRules", () => {
  it("returns null for missing rules", () => {
    assert.equal(validateScoringRules(undefined), null);
    assert.equal(validateScoringRules(null), null);
  });

  it("accepts valid cutoffs, maxScore and note", () => {
    const rules = validateScoringRules({
      maxScore: 30,
      riskCutoffs: { medium: 0.4, high: 0.7 },
      note: "ปรับตามทีมจิตวิทยา",
    });
    assert.deepEqual(rules?.riskCutoffs, { medium: 0.4, high: 0.7 });
    assert.equal(rules?.maxScore, 30);
  });

  it("rejects medium >= high", () => {
    assert.throws(
      () => validateScoringRules({ riskCutoffs: { medium: 0.7, high: 0.7 } }),
      SurveyScoringRulesError
    );
    assert.throws(
      () => validateScoringRules({ riskCutoffs: { medium: 0.8, high: 0.5 } }),
      SurveyScoringRulesError
    );
  });

  it("rejects out-of-range cutoffs, unknown fields and bad maxScore", () => {
    assert.throws(() => validateScoringRules({ riskCutoffs: { medium: 0, high: 0.5 } }), SurveyScoringRulesError);
    assert.throws(() => validateScoringRules({ riskCutoffs: { medium: 0.5, high: 1.5 } }), SurveyScoringRulesError);
    assert.throws(() => validateScoringRules({ isAdmin: true }), SurveyScoringRulesError);
    assert.throws(() => validateScoringRules({ maxScore: -1 }), SurveyScoringRulesError);
    assert.throws(() => validateScoringRules("not-an-object"), SurveyScoringRulesError);
  });
});

describe("snapshot helpers", () => {
  it("toSnapshotQuestionRows sorts by order and keeps sourceQuestionId", () => {
    const rows = toSnapshotQuestionRows([question("q2", 2), question("q1", 1)]);
    assert.deepEqual(
      rows.map((row) => row.sourceQuestionId),
      ["q1", "q2"]
    );
  });

  it("isSnapshotCurrent is true for identical content", () => {
    const current = [question("q1", 1), question("q2", 2)];
    assert.equal(isSnapshotCurrent(toSnapshotQuestionRows(current), current), true);
  });

  it("isSnapshotCurrent ignores option key order", () => {
    const current = [question("q1", 1)];
    const snapshot = toSnapshotQuestionRows([
      question("q1", 1, {
        options: [
          { score: 0, value: "a", label: "น้อย" },
          { score: 3, value: "b", label: "มาก" },
        ],
      }),
    ]);
    assert.equal(isSnapshotCurrent(snapshot, current), true);
  });

  it("isSnapshotCurrent detects prompt, option score, added or removed questions", () => {
    const current = [question("q1", 1), question("q2", 2)];
    const snapshot = toSnapshotQuestionRows(current);

    assert.equal(
      isSnapshotCurrent(snapshot, [question("q1", 1, { prompt: "แก้ข้อความ" }), question("q2", 2)]),
      false
    );
    assert.equal(
      isSnapshotCurrent(snapshot, [
        question("q1", 1, {
          options: [
            { label: "น้อย", value: "a", score: 1 },
            { label: "มาก", value: "b", score: 3 },
          ],
        }),
        question("q2", 2),
      ]),
      false
    );
    assert.equal(isSnapshotCurrent(snapshot, [question("q1", 1)]), false);
    assert.equal(isSnapshotCurrent(snapshot, [...current, question("q3", 3)]), false);
  });
});

describe("serializeVersionQuestionsForPreview", () => {
  it("strips option scores and sorts by order", () => {
    const payload = serializeVersionQuestionsForPreview([question("q2", 2), question("q1", 1)]);
    assert.deepEqual(
      payload.map((item) => item.id),
      ["q1", "q2"]
    );
    for (const item of payload) {
      for (const option of item.options) {
        assert.equal("score" in option, false);
      }
    }
  });
});

describe("buildScoringSnapshot", () => {
  it("records defaults when no custom rules exist", () => {
    const snapshot = buildScoringSnapshot({
      versionId: "v1",
      version: 1,
      instrumentCode: SurveyInstrumentCode.CUSTOM,
      rules: null,
    });
    assert.deepEqual(snapshot.riskCutoffs, { medium: 0.34, high: 0.67 });
    assert.equal(snapshot.customCutoffsApplied, false);
  });

  it("records admin cutoffs for CUSTOM", () => {
    const snapshot = buildScoringSnapshot({
      versionId: "v2",
      version: 2,
      instrumentCode: SurveyInstrumentCode.CUSTOM,
      rules: { riskCutoffs: { medium: 0.5, high: 0.8 }, note: "n" },
    });
    assert.deepEqual(snapshot.riskCutoffs, { medium: 0.5, high: 0.8 });
    assert.equal(snapshot.customCutoffsApplied, true);
    assert.equal(snapshot.note, "n");
  });

  it("ignores custom cutoffs for GHQ28", () => {
    const snapshot = buildScoringSnapshot({
      versionId: "v1",
      version: 1,
      instrumentCode: SurveyInstrumentCode.GHQ28,
      rules: { riskCutoffs: { medium: 0.5, high: 0.8 } },
    });
    assert.deepEqual(snapshot.riskCutoffs, { medium: 0.34, high: 0.67 });
    assert.equal(snapshot.customCutoffsApplied, false);
  });
});

describe("buildDuplicateTitle", () => {
  it("appends copy suffix", () => {
    assert.equal(buildDuplicateTitle("แบบประเมิน A"), "แบบประเมิน A (สำเนา)");
  });

  it("keeps title within 200 characters", () => {
    assert.equal(buildDuplicateTitle("ก".repeat(300)).length, 200);
  });
});
