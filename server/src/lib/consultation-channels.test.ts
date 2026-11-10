import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConsultationPreferredChannel, ConsultationRequestStatus } from "@prisma/client";
import {
  canAdvisorCloseCompletedConsultation,
  canAdvisorConfirmCancelConsultation,
  canAdvisorDirectCancelConsultation,
  canStudentCancelConsultation,
  consultationChannelLabel,
  isStudentRequestChannel,
  scheduleLocationPlaceholder,
  studentRequestChannelOptions,
} from "./consultation-channels";

describe("consultation-channels", () => {
  it("จำกัดช่องทางที่นิสิตเลือกได้แค่ออนไลน์กับพบตัว", () => {
    assert.deepEqual(Object.keys(studentRequestChannelOptions()).sort(), ["IN_PERSON", "ONLINE"]);
    assert.equal(isStudentRequestChannel("ONLINE"), true);
    assert.equal(isStudentRequestChannel("IN_PERSON"), true);
    assert.equal(isStudentRequestChannel("PHONE"), false);
    assert.equal(isStudentRequestChannel("MESSAGE"), false);
  });

  it("ป้ายและ placeholder สถานที่ตามช่องทาง", () => {
    assert.equal(consultationChannelLabel(ConsultationPreferredChannel.ONLINE), "ออนไลน์");
    assert.equal(consultationChannelLabel(ConsultationPreferredChannel.IN_PERSON), "พบตัว / ที่คณะ");
    assert.match(
      scheduleLocationPlaceholder(ConsultationPreferredChannel.ONLINE),
      /Teams|Zoom/
    );
    assert.match(
      scheduleLocationPlaceholder(ConsultationPreferredChannel.IN_PERSON),
      /ห้อง/
    );
  });

  it("นิสิตขอยกเลิกได้เฉพาะก่อนยืนยันนัด และอาจารย์ยืนยัน/ปิดตามสถานะ", () => {
    assert.equal(canStudentCancelConsultation(ConsultationRequestStatus.PENDING), true);
    assert.equal(canStudentCancelConsultation(ConsultationRequestStatus.ACCEPTED), true);
    assert.equal(canStudentCancelConsultation(ConsultationRequestStatus.SCHEDULED), false);
    assert.equal(canStudentCancelConsultation(ConsultationRequestStatus.CANCEL_REQUESTED), false);
    assert.equal(canStudentCancelConsultation(ConsultationRequestStatus.CLOSED), false);
    assert.equal(canStudentCancelConsultation(ConsultationRequestStatus.CANCELLED), false);

    assert.equal(canAdvisorConfirmCancelConsultation(ConsultationRequestStatus.CANCEL_REQUESTED), true);
    assert.equal(canAdvisorConfirmCancelConsultation(ConsultationRequestStatus.PENDING), false);
    assert.equal(canAdvisorDirectCancelConsultation(ConsultationRequestStatus.PENDING), true);
    assert.equal(canAdvisorDirectCancelConsultation(ConsultationRequestStatus.ACCEPTED), true);
    assert.equal(canAdvisorDirectCancelConsultation(ConsultationRequestStatus.SCHEDULED), false);
    assert.equal(canAdvisorCloseCompletedConsultation(ConsultationRequestStatus.SCHEDULED), true);
    assert.equal(canAdvisorCloseCompletedConsultation(ConsultationRequestStatus.PENDING), false);
  });
});
