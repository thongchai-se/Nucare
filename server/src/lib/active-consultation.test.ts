import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConsultationRequestStatus } from "@prisma/client";
import {
  ACTIVE_CONSULTATION_STATUSES,
  activeConsultationConflictMessage,
  isActiveConsultationStatus,
} from "./active-consultation";

describe("active-consultation", () => {
  it("PENDING / ACCEPTED / SCHEDULED / CANCEL_REQUESTED ถือว่ายังเปิดอยู่", () => {
    assert.equal(isActiveConsultationStatus(ConsultationRequestStatus.PENDING), true);
    assert.equal(isActiveConsultationStatus(ConsultationRequestStatus.ACCEPTED), true);
    assert.equal(isActiveConsultationStatus(ConsultationRequestStatus.SCHEDULED), true);
    assert.equal(isActiveConsultationStatus(ConsultationRequestStatus.CANCEL_REQUESTED), true);
    assert.equal(isActiveConsultationStatus(ConsultationRequestStatus.CLOSED), false);
    assert.equal(isActiveConsultationStatus(ConsultationRequestStatus.CANCELLED), false);
  });

  it("ACTIVE_CONSULTATION_STATUSES ครอบคลุมเฉพาะสถานะที่ยังไม่จบ", () => {
    assert.deepEqual(ACTIVE_CONSULTATION_STATUSES, [
      ConsultationRequestStatus.PENDING,
      ConsultationRequestStatus.ACCEPTED,
      ConsultationRequestStatus.SCHEDULED,
      ConsultationRequestStatus.CANCEL_REQUESTED,
    ]);
  });

  it("ข้อความขัดแย้งแยกตามสถานะ", () => {
    assert.match(
      activeConsultationConflictMessage(ConsultationRequestStatus.SCHEDULED),
      /นัดปรึกษาที่ยืนยันแล้ว/
    );
    assert.match(
      activeConsultationConflictMessage(ConsultationRequestStatus.CANCEL_REQUESTED),
      /ขอยกเลิก/
    );
    assert.match(
      activeConsultationConflictMessage(ConsultationRequestStatus.ACCEPTED),
      /รับแล้ว/
    );
    assert.match(
      activeConsultationConflictMessage(ConsultationRequestStatus.PENDING),
      /รออาจารย์รับ/
    );
  });
});
