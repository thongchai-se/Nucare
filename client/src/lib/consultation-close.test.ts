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
  it("CC-C01 ป้ายปิดเคสแล้วเสมอ · โทนเหลืองเมื่อกลางทาง", () => {
    assert.ok(STUDENT_MID_QUEUE_CLOSE_REASONS.length >= 6);
    assert.equal(isStudentMidQueueCloseReason(STUDENT_MID_QUEUE_CLOSE_REASONS[0]), true);
    assert.equal(consultationClosedStatusLabel(null), CLOSED_CASE_LABEL);
    assert.equal(
      consultationClosedStatusLabel(`${MID_QUEUE_CLOSE_PREFIX}ตารางเวลาไม่สะดวกในช่วงนี้`),
      CLOSED_CASE_LABEL
    );
    assert.equal(consultationClosedTone(MID_QUEUE_CLOSE_MARKER), "mid");
    assert.equal(consultationClosedTone("คุยจบ"), "done");
    assert.match(consultationClosedBadgeClassName(MID_QUEUE_CLOSE_MARKER), /amber/);
    assert.match(consultationClosedBadgeClassName("คุยจบ"), /emerald/);
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
