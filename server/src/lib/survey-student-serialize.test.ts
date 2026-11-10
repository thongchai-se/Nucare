import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SurveyQuestionType } from "@prisma/client";
import {
  serializeStudentFacingSurvey,
  serializeStudentSurveyQuestions,
  stripOptionScores,
} from "./survey-student-serialize";

describe("stripOptionScores", () => {
  it("removes score fields from choice options", () => {
    const stripped = stripOptionScores([
      { label: "ดี", value: "0", score: 0 },
      { label: "แย่", value: "3", score: 3 },
    ]);
    assert.deepEqual(stripped, [
      { label: "ดี", value: "0" },
      { label: "แย่", value: "3" },
    ]);
    assert.equal("score" in (stripped[0] as object), false);
  });
});

describe("serializeStudentFacingSurvey", () => {
  it("exposes neutral fields only (no risk or eligibility)", () => {
    const payload = serializeStudentFacingSurvey({
      id: "survey-1",
      title: "แบบประเมินรอบนี้",
      description: "กรุณาตอบตามความเป็นจริง",
      waveId: "wave-1",
      waveLabel: "สัปดาห์ที่ 1",
      closesAt: null,
      questions: [
        {
          id: "q1",
          type: SurveyQuestionType.SINGLE_CHOICE,
          prompt: "คำถาม",
          description: null,
          isRequired: true,
          order: 1,
          options: [{ label: "A", value: "a", score: 2 }],
          minValue: null,
          maxValue: null,
        },
      ],
    });

    assert.equal(payload.id, "survey-1");
    assert.equal(payload.waveId, "wave-1");
    assert.deepEqual(Object.keys(payload).sort(), [
      "closesAt",
      "description",
      "id",
      "questions",
      "title",
      "waveId",
      "waveLabel",
    ]);
    assert.deepEqual(payload.questions[0].options, [{ label: "A", value: "a" }]);
  });
});

describe("serializeStudentSurveyQuestions", () => {
  it("preserves scale bounds without option scores", () => {
    const questions = serializeStudentSurveyQuestions([
      {
        id: "q-scale",
        type: SurveyQuestionType.SCALE,
        prompt: "ระดับ",
        description: null,
        isRequired: true,
        order: 1,
        options: null,
        minValue: 0,
        maxValue: 10,
      },
    ]);
    assert.equal(questions[0].minValue, 0);
    assert.equal(questions[0].maxValue, 10);
    assert.deepEqual(questions[0].options, []);
  });
});
