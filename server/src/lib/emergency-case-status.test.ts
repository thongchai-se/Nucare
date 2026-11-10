import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EmergencyCaseStatus } from "@prisma/client";
import {
  canTransitionEmergencyCaseStatus,
  emergencyCaseStatusLabel,
  emergencyCaseTransitionError,
} from "./emergency-case-status";

describe("emergency-case status transitions", () => {
  it("ECS-01 จาก OPEN ไป IN_PROGRESS หรือ RESOLVED ได้", () => {
    assert.equal(
      canTransitionEmergencyCaseStatus(EmergencyCaseStatus.OPEN, EmergencyCaseStatus.IN_PROGRESS),
      true
    );
    assert.equal(
      canTransitionEmergencyCaseStatus(EmergencyCaseStatus.OPEN, EmergencyCaseStatus.RESOLVED),
      true
    );
  });

  it("ECS-02 จาก IN_PROGRESS ปิดได้เท่านั้น", () => {
    assert.equal(
      canTransitionEmergencyCaseStatus(
        EmergencyCaseStatus.IN_PROGRESS,
        EmergencyCaseStatus.RESOLVED
      ),
      true
    );
    assert.equal(
      canTransitionEmergencyCaseStatus(EmergencyCaseStatus.IN_PROGRESS, EmergencyCaseStatus.OPEN),
      false
    );
  });

  it("ECS-03 เคสปิดแล้วเปลี่ยนต่อไม่ได้", () => {
    assert.equal(
      canTransitionEmergencyCaseStatus(EmergencyCaseStatus.RESOLVED, EmergencyCaseStatus.OPEN),
      false
    );
    assert.match(
      emergencyCaseTransitionError(EmergencyCaseStatus.RESOLVED, EmergencyCaseStatus.OPEN),
      /ปิดแล้ว/
    );
  });

  it("ECS-04 ป้ายสถานะภาษาไทย", () => {
    assert.equal(emergencyCaseStatusLabel(EmergencyCaseStatus.OPEN), "รอรับ");
    assert.equal(emergencyCaseStatusLabel(EmergencyCaseStatus.IN_PROGRESS), "กำลังดำเนินการ");
    assert.equal(emergencyCaseStatusLabel(EmergencyCaseStatus.RESOLVED), "ปิดแล้ว");
  });
});
