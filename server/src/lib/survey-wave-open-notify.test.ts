import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWaveOpenAlertCopy,
  pickIncompleteWaveAssignees,
} from "./survey-wave-open-notify";

describe("survey wave open notify", () => {
  it("SWON-01 ส่งเฉพาะ assignment ที่ยังไม่ completedAt", () => {
    const students = pickIncompleteWaveAssignees([
      { completedAt: null, student: { id: "a", name: "A" } },
      { completedAt: new Date("2026-11-01T00:00:00.000Z"), student: { id: "b", name: "B" } },
      { completedAt: null, student: { id: "c", name: "C" } },
    ]);
    assert.deepEqual(
      students.map((student) => student.id),
      ["a", "c"]
    );
  });

  it("SWON-02 ไม่ซ้ำ studentId และข้าม student ว่าง", () => {
    const students = pickIncompleteWaveAssignees([
      { completedAt: null, student: { id: "a" } },
      { completedAt: null, student: { id: "a" } },
      { completedAt: null, student: null },
    ]);
    assert.deepEqual(
      students.map((student) => student.id),
      ["a"]
    );
  });

  it("SWON-03 ข้อความแจ้งระบุชื่อแบบประเมินและรอบ", () => {
    const copy = buildWaveOpenAlertCopy({
      surveyTitle: "GHQ-28",
      waveLabel: "เทอม 1/2569",
    });
    assert.match(copy.title, /แบบประเมิน/);
    assert.match(copy.message, /GHQ-28/);
    assert.match(copy.message, /เทอม 1\/2569/);
  });
});
