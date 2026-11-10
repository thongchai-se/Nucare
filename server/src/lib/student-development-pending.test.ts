import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  escapeHtmlForEmail,
  isStudentDevelopmentPendingAssessment,
} from "./student-development-pending";

describe("student-development pending screening", () => {
  it("SDP-01 มี assignment คลื่นเปิดถือว่าค้างแม้เคยประเมินแล้ว", () => {
    assert.equal(
      isStudentDevelopmentPendingAssessment({
        surveyAssignments: [{ id: "a1" }],
        surveyResponses: [{ id: "r1" }],
        studentAssessments: [{ id: "s1" }],
      }),
      true
    );
  });

  it("SDP-02 ไม่มีผลประเมินเลยถือว่าค้าง", () => {
    assert.equal(
      isStudentDevelopmentPendingAssessment({
        surveyAssignments: [],
        surveyResponses: [],
        studentAssessments: [],
      }),
      true
    );
  });

  it("SDP-03 มีผลแล้วและไม่มี assignment เปิด ไม่ถือว่าค้าง", () => {
    assert.equal(
      isStudentDevelopmentPendingAssessment({
        surveyAssignments: [],
        surveyResponses: [{ id: "r1" }],
        studentAssessments: [],
      }),
      false
    );
  });

  it("SDP-04 หนี HTML ในข้อความอีเมล", () => {
    assert.equal(escapeHtmlForEmail(`<b>hi</b> & "x"`), "&lt;b&gt;hi&lt;/b&gt; &amp; &quot;x&quot;");
  });
});
