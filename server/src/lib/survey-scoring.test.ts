import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RiskLevel, SurveyQuestionType } from "@prisma/client";
import {
  calculateSurveyMaxScore,
  calculateSurveyResponseScore,
  getGhq28DistressLevel,
  getGhq28OptionScore,
  getGhq28RiskLevel,
  getSurveyRiskLevel,
  GHQ28_MAX_SCORE,
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
