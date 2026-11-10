import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHighRiskAdvisorEmail,
  buildStudentCounselingRequestEmail,
} from "./messages";

describe("email messages", () => {
  it("EM-01 HIGH advisor email มีชื่อนิสิตและแหล่งที่มา", () => {
    const msg = buildHighRiskAdvisorEmail({
      studentName: "สมชาย",
      studentIdLabel: "663450001-1",
      sourceLabel: "9Q",
    });
    assert.match(msg.subject, /สมชาย/);
    assert.match(msg.text, /9Q/);
    assert.match(msg.html, /663450001-1/);
  });

  it("EM-02 student counseling email หนี HTML ในหมายเหตุ", () => {
    const msg = buildStudentCounselingRequestEmail({
      studentName: "สมหญิง",
      studentIdLabel: null,
      note: '<script>alert("x")</script>',
    });
    assert.doesNotMatch(msg.html, /<script>/);
    assert.match(msg.html, /&lt;script&gt;/);
  });
});
