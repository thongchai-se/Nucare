import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOSED_CASE_LABEL,
  consultationClosedBadgeClassName,
  consultationClosedStatusLabel,
  consultationClosedTone,
  isMidQueueCloseNote,
  isStudentMidQueueCloseReason,
  MID_QUEUE_CLOSE_MARKER,
  MID_QUEUE_CLOSE_PREFIX,
  presentCloseNoteForStudent,
  STUDENT_MID_QUEUE_CLOSE_REASONS,
} from "./consultation-close";

describe("consultation-close (client)", () => {
  it("CC-C01 ป้ายยกเลิก/ปิดเคสใช้สีทึบอ่านชัด", () => {
    assert.ok(STUDENT_MID_QUEUE_CLOSE_REASONS.length >= 6);
    assert.equal(isStudentMidQueueCloseReason(STUDENT_MID_QUEUE_CLOSE_REASONS[0]), true);
    assert.equal(consultationClosedStatusLabel(null), CLOSED_CASE_LABEL);
    assert.equal(
      consultationClosedStatusLabel(`${MID_QUEUE_CLOSE_PREFIX}ตารางเวลาไม่สะดวกในช่วงนี้`),
      "ยกเลิก"
    );
    assert.equal(consultationClosedStatusLabel("CANCEL_REQUESTED"), "นศขอยกเลิก");
    assert.equal(consultationClosedTone(MID_QUEUE_CLOSE_MARKER), "cancelled");
    assert.equal(consultationClosedTone("คุยจบ"), "done");
    assert.match(consultationClosedBadgeClassName(MID_QUEUE_CLOSE_MARKER), /amber-700/);
    assert.match(consultationClosedBadgeClassName("คุยจบ"), /emerald-600/);
    assert.doesNotMatch(consultationClosedBadgeClassName("CANCEL_REQUESTED"), /amber-100/);
    assert.doesNotMatch(consultationClosedBadgeClassName("CANCELLED"), /amber-100/);
    assert.equal(isMidQueueCloseNote(MID_QUEUE_CLOSE_MARKER), true);
  });

  it("CC-C02 ตัด marker ตอนแสดงให้นิสิต", () => {
    assert.equal(
      presentCloseNoteForStudent(`${MID_QUEUE_CLOSE_PREFIX}ส่งคำขอผิดพลาด หรือยังไม่พร้อมคุย`),
      "ส่งคำขอผิดพลาด หรือยังไม่พร้อมคุย"
    );
    assert.equal(presentCloseNoteForStudent("พูดคุยเรียบร้อย"), "พูดคุยเรียบร้อย");
    assert.equal(presentCloseNoteForStudent(null), null);
  });
});
