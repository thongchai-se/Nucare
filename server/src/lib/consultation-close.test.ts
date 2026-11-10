import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADVISOR_CANCEL_REASON_OTHER,
  ADVISOR_CANCEL_REASONS,
  CANCELLED_CASE_LABEL,
  CANCEL_REQUESTED_LABEL,
  CANCEL_REQUEST_MARKER,
  CANCEL_REQUEST_PREFIX,
  CLOSED_CASE_LABEL,
  consultationClosedStatusLabel,
  consultationClosedTone,
  formatAdvisorConfirmCancelNote,
  formatAdvisorDirectCancelNote,
  formatStudentCancelRequestNote,
  isAdvisorCancelReason,
  isCancelRequestNote,
  isStudentCancelReason,
  STUDENT_CANCEL_REASONS,
  validateAdvisorCancelReasonInput,
} from "./consultation-close";

describe("consultation-close", () => {
  it("CC-01 เหตุผลนิสิตครบและกันค่าแปลก", () => {
    assert.ok(STUDENT_CANCEL_REASONS.length >= 6);
    assert.equal(isStudentCancelReason(STUDENT_CANCEL_REASONS[0]), true);
    assert.equal(isStudentCancelReason("ปิดเพราะขี้เกียจ"), false);
    assert.equal(isStudentCancelReason(""), false);
  });

  it("CC-02 จัดรูปหมายเหตุขอยกเลิกและยืนยันของอาจารย์", () => {
    const studentNote = formatStudentCancelRequestNote("ตารางเวลาไม่สะดวกในช่วงนี้");
    assert.equal(studentNote, `${CANCEL_REQUEST_PREFIX}ตารางเวลาไม่สะดวกในช่วงนี้`);
    assert.equal(isCancelRequestNote(studentNote), true);

    assert.equal(formatAdvisorConfirmCancelNote(studentNote, ""), studentNote);
    assert.match(
      formatAdvisorConfirmCancelNote(studentNote, "รับทราบแล้ว"),
      /อาจารย์รับทราบ: รับทราบแล้ว/
    );
    assert.equal(formatAdvisorConfirmCancelNote(null, ""), CANCEL_REQUEST_MARKER);
  });

  it("CC-03 ป้ายยกเลิกเหลือง / ปิดเคสแล้วเขียว", () => {
    assert.equal(consultationClosedStatusLabel("CANCELLED"), CANCELLED_CASE_LABEL);
    assert.equal(consultationClosedStatusLabel("CANCEL_REQUESTED"), CANCEL_REQUESTED_LABEL);
    assert.equal(CANCEL_REQUESTED_LABEL, "นศขอยกเลิก");
    assert.equal(consultationClosedStatusLabel("CLOSED", null), CLOSED_CASE_LABEL);
    assert.equal(consultationClosedStatusLabel("CLOSED", "พูดคุยเรียบร้อย"), CLOSED_CASE_LABEL);
    assert.equal(
      consultationClosedStatusLabel("CLOSED", `${CANCEL_REQUEST_PREFIX}ยังไม่พร้อม`),
      CANCELLED_CASE_LABEL
    );

    assert.equal(consultationClosedTone("CANCELLED"), "cancelled");
    assert.equal(consultationClosedTone("CLOSED", null), "done");
    assert.equal(consultationClosedTone("CLOSED", CANCEL_REQUEST_MARKER), "cancelled");
  });

  it("CC-04 อาจารย์ยกเลิกเองต้องมีเหตุผล และอื่นๆ ต้องกรอกเพิ่ม", () => {
    assert.ok(ADVISOR_CANCEL_REASONS.includes(ADVISOR_CANCEL_REASON_OTHER));
    assert.equal(isAdvisorCancelReason("นิสิตติดต่อไม่ได้ / ไม่ตอบกลับ"), true);
    assert.equal(isAdvisorCancelReason("ไม่มีในรายการ"), false);
    assert.equal(validateAdvisorCancelReasonInput(undefined), "กรุณาเลือกเหตุผลการยกเลิก");
    assert.equal(validateAdvisorCancelReasonInput("นิสิตติดต่อไม่ได้ / ไม่ตอบกลับ"), null);
    assert.match(
      validateAdvisorCancelReasonInput(ADVISOR_CANCEL_REASON_OTHER, "") || "",
      /รายละเอียด/
    );
    assert.equal(
      validateAdvisorCancelReasonInput(ADVISOR_CANCEL_REASON_OTHER, "นัดไม่ตรงช่วงสอบ"),
      null
    );
    assert.match(
      formatAdvisorDirectCancelNote("นิสิตติดต่อไม่ได้ / ไม่ตอบกลับ"),
      /อาจารย์ยกเลิก/
    );
    assert.match(
      formatAdvisorDirectCancelNote(ADVISOR_CANCEL_REASON_OTHER, "ติดภารกิจคณะ"),
      /อื่นๆ: ติดภารกิจคณะ/
    );
  });
});
