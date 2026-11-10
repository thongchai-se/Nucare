import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateStudentChatGuardrails } from "./guardrails";

describe("student chat guardrails", () => {
  it("CG-01 blocks homework requests", () => {
    const result = evaluateStudentChatGuardrails("ช่วยทำการบ้านวิชาชีววิทยาให้หน่อย");
    assert.equal(result.blocked, true);
    if (result.blocked) {
      assert.equal(result.reason, "homework");
    }
  });

  it("CG-02 blocks exam and answer-key phrasing", () => {
    assert.equal(evaluateStudentChatGuardrails("ขอเฉลยข้อสอบ midterm").blocked, true);
    assert.equal(evaluateStudentChatGuardrails("write my essay for me").blocked, true);
  });

  it("CG-03 allows emotional support talk", () => {
    const result = evaluateStudentChatGuardrails("วันนี้เครียดมาก นอนไม่หลับ");
    assert.equal(result.blocked, false);
    assert.equal(result.crisis, false);
  });

  it("CG-04 flags crisis language without blocking as homework", () => {
    const result = evaluateStudentChatGuardrails("รู้สึกอยากตายเลย");
    assert.equal(result.blocked, false);
    assert.equal(result.crisis, true);
  });

  it("CG-05 blocks pasted code dumps without homework keywords", () => {
    const dump = [
      "```js",
      "function solve(n) {",
      "  const a = n + 1;",
      "  console.log(a);",
      "  return a;",
      "}",
      "```",
    ].join("\n");
    const result = evaluateStudentChatGuardrails(dump);
    assert.equal(result.blocked, true);
    if (result.blocked) {
      assert.equal(result.reason, "homework");
    }
  });

  it("CG-06 blocks Thai programming assignment phrasing", () => {
    assert.equal(evaluateStudentChatGuardrails("จงเขียนโปรแกรมหาผลรวม").blocked, true);
    assert.equal(evaluateStudentChatGuardrails("ช่วย debug ให้หน่อย").blocked, true);
  });
});
