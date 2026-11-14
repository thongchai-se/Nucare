import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RiskLevel, SurveyInstrumentCode, SurveyQuestionType } from "@prisma/client";
import {
  buildStudentFacingSurveyResult,
  calculateSurveyMaxScore,
  calculateSurveyResponseScore,
  enrichSurveyResponseScores,
  getGhq28DistressLevel,
  getGhq28OptionScore,
  getGhq28RiskLevel,
  getSurveyRiskLevel,
  GHQ28_MAX_SCORE,
  parseSurveyScoringRules,
  resolveRiskCutoffs,
} from "./survey-scoring";

const ghq28Title = "แบบทดสอบสุขภาพทั่วไป Thai GHQ-28";

const createGhq28Question = (id: string, order: number) => ({
  id,
  type: SurveyQuestionType.SINGLE_CHOICE,
  minValue: null,
  maxValue: null,
  options: [
    { label: "ช่อง 1", score: 0, value: `q${order}_1` },
    { label: "ช่อง 2", score: 1, value: `q${order}_2` },
    { label: "ช่อง 3", score: 2, value: `q${order}_3` },
    { label: "ช่อง 4", score: 3, value: `q${order}_4` },
  ],
});

const ghq28Questions = Array.from({ length: 28 }, (_, index) =>
  createGhq28Question(`q-${index + 1}`, index + 1)
);

describe("GHQ-28 Likert scoring", () => {
  it("SC-01 score 0 is NORMAL", () => {
    assert.equal(getGhq28DistressLevel(0)?.level, "NORMAL");
    assert.equal(getGhq28RiskLevel(0), RiskLevel.NORMAL);
    assert.equal(getSurveyRiskLevel(ghq28Title, 0, GHQ28_MAX_SCORE), RiskLevel.NORMAL);
  });

  it("SC-02 score 14 boundary is NORMAL", () => {
    assert.equal(getGhq28DistressLevel(14)?.level, "NORMAL");
    assert.equal(getGhq28RiskLevel(14), RiskLevel.NORMAL);
  });

  it("SC-03 score 15 boundary is MILD", () => {
    assert.equal(getGhq28DistressLevel(15)?.level, "MILD");
    assert.equal(getGhq28RiskLevel(15), RiskLevel.MEDIUM);
  });

  it("SC-04 score 28 boundary is MILD", () => {
    assert.equal(getGhq28DistressLevel(28)?.level, "MILD");
    assert.equal(getGhq28RiskLevel(28), RiskLevel.MEDIUM);
  });

  it("SC-05 score 29 boundary is MODERATE", () => {
    assert.equal(getGhq28DistressLevel(29)?.level, "MODERATE");
    assert.equal(getGhq28RiskLevel(29), RiskLevel.MEDIUM);
  });

  it("SC-06 score 42 boundary is MODERATE", () => {
    assert.equal(getGhq28DistressLevel(42)?.level, "MODERATE");
    assert.equal(getGhq28RiskLevel(42), RiskLevel.MEDIUM);
  });

  it("SC-07 score 43 boundary is SEVERE", () => {
    assert.equal(getGhq28DistressLevel(43)?.level, "SEVERE");
    assert.equal(getGhq28RiskLevel(43), RiskLevel.HIGH);
  });

  it("SC-08 score 84 is SEVERE", () => {
    assert.equal(getGhq28DistressLevel(84)?.level, "SEVERE");
    assert.equal(getGhq28RiskLevel(84), RiskLevel.HIGH);
  });

  it("SC-09 option index scoring and max score 84", () => {
    const options = ghq28Questions[0].options!;
    assert.equal(getGhq28OptionScore(options, "q1_1"), 0);
    assert.equal(getGhq28OptionScore(options, "q1_2"), 1);
    assert.equal(getGhq28OptionScore(options, "q1_3"), 2);
    assert.equal(getGhq28OptionScore(options, "q1_4"), 3);
    assert.equal(calculateSurveyMaxScore(ghq28Questions, ghq28Title), 84);

    const allZeroAnswers = ghq28Questions.map((question) => ({
      questionId: question.id,
      value: `${question.options![0].value}`,
    }));
    assert.equal(
      calculateSurveyResponseScore(ghq28Questions, allZeroAnswers, ghq28Title),
      0
    );

    const allMaxAnswers = ghq28Questions.map((question) => ({
      questionId: question.id,
      value: `${question.options![3].value}`,
    }));
    assert.equal(
      calculateSurveyResponseScore(ghq28Questions, allMaxAnswers, ghq28Title),
      84
    );
  });
});

describe("buildStudentFacingSurveyResult", () => {
  it("ส่งคะแนนและป้ายผลให้นิสิตหลังทำแบบ", () => {
    const result = buildStudentFacingSurveyResult({
      id: "resp-1",
      submittedAt: new Date("2026-11-05T03:00:00.000Z"),
      totalScore: 20,
      maxScore: 84,
      surveyTitle: ghq28Title,
    });
    assert.equal(result.id, "resp-1");
    assert.equal(result.totalScore, 20);
    assert.equal(result.maxScore, 84);
    assert.equal(result.distressLevel, "MILD");
    assert.match(String(result.distressLabel), /น้อย|Mild/);
  });

  it("CUSTOM แสดงคะแนนและป้ายระดับจาก riskLevel ให้นิสิต", () => {
    const result = buildStudentFacingSurveyResult({
      id: "resp-2",
      submittedAt: "2026-11-12T08:00:00.000Z",
      totalScore: 8,
      maxScore: 12,
      surveyTitle: "แบบประเมินสั้น",
      riskLevel: RiskLevel.MEDIUM,
    });
    assert.equal(result.totalScore, 8);
    assert.equal(result.maxScore, 12);
    assert.equal(result.distressLevel, null);
    assert.equal(result.distressLabel, "ระดับที่ควรติดตาม");
  });

  it("CUSTOM ไม่ส่ง riskLevel แล้วยังอนุมานป้ายจากคะแนนได้", () => {
    const result = buildStudentFacingSurveyResult({
      id: "resp-3",
      submittedAt: "2026-11-12T08:00:00.000Z",
      totalScore: 10,
      maxScore: 12,
      surveyTitle: "แบบประเมินสั้น",
    });
    assert.equal(result.totalScore, 10);
    assert.equal(result.distressLabel, "ระดับที่ควรขอคำปรึกษา");
  });
});

describe("getSurveyRiskLevel — CUSTOM scoring rules", () => {
  const customTitle = "แบบประเมินความเครียดภายในคณะ";

  it("ใช้เกณฑ์เริ่มต้น 0.34/0.67 เมื่อไม่มีกฎ", () => {
    assert.equal(getSurveyRiskLevel(customTitle, 33, 100), RiskLevel.NORMAL);
    assert.equal(getSurveyRiskLevel(customTitle, 34, 100), RiskLevel.MEDIUM);
    assert.equal(getSurveyRiskLevel(customTitle, 67, 100), RiskLevel.HIGH);
  });

  it("ใช้ riskCutoffs ที่แอดมินกำหนดกับ CUSTOM", () => {
    const rules = { riskCutoffs: { medium: 0.5, high: 0.8 } };
    assert.equal(getSurveyRiskLevel(customTitle, 40, 100, rules, SurveyInstrumentCode.CUSTOM), RiskLevel.NORMAL);
    assert.equal(getSurveyRiskLevel(customTitle, 50, 100, rules, SurveyInstrumentCode.CUSTOM), RiskLevel.MEDIUM);
    assert.equal(getSurveyRiskLevel(customTitle, 80, 100, rules, SurveyInstrumentCode.CUSTOM), RiskLevel.HIGH);
  });

  it("กฎที่ไม่มี riskCutoffs ยังใช้เกณฑ์เริ่มต้น", () => {
    assert.equal(
      getSurveyRiskLevel(customTitle, 40, 100, { note: "x" }, SurveyInstrumentCode.CUSTOM),
      RiskLevel.MEDIUM
    );
  });

  it("GHQ28 ไม่เปลี่ยน แม้มีกฎ riskCutoffs", () => {
    const rules = { riskCutoffs: { medium: 0.9, high: 0.95 } };
    assert.equal(
      getSurveyRiskLevel(ghq28Title, 43, GHQ28_MAX_SCORE, rules, SurveyInstrumentCode.GHQ28),
      RiskLevel.HIGH
    );
    assert.equal(
      getSurveyRiskLevel("ชื่อทั่วไป", 43, GHQ28_MAX_SCORE, rules, SurveyInstrumentCode.GHQ28),
      RiskLevel.HIGH
    );
  });

  it("resolveRiskCutoffs / parseSurveyScoringRules จัดการค่าไม่ถูกต้อง", () => {
    assert.deepEqual(resolveRiskCutoffs(null, SurveyInstrumentCode.CUSTOM), { medium: 0.34, high: 0.67 });
    assert.equal(parseSurveyScoringRules({ riskCutoffs: { medium: 0.9, high: 0.5 } }), null);
    assert.equal(parseSurveyScoringRules(null), null);
    assert.deepEqual(parseSurveyScoringRules({ riskCutoffs: { medium: 0.4, high: 0.6 } })?.riskCutoffs, {
      medium: 0.4,
      high: 0.6,
    });
  });

  it("enrichSurveyResponseScores ใช้กฎจากเวอร์ชัน", () => {
    const questions = [
      {
        id: "q1",
        type: SurveyQuestionType.SCALE,
        options: null,
        minValue: 1,
        maxValue: 10,
      },
    ];
    const answers = [{ questionId: "q1", value: 5 }];
    const withDefault = enrichSurveyResponseScores(customTitle, questions, answers);
    assert.equal(withDefault.riskLevel, RiskLevel.MEDIUM);
    const strict = enrichSurveyResponseScores(customTitle, questions, answers, {
      scoringRules: { riskCutoffs: { medium: 0.6, high: 0.9 } },
      instrumentCode: SurveyInstrumentCode.CUSTOM,
    });
    assert.equal(strict.riskLevel, RiskLevel.NORMAL);
  });
});