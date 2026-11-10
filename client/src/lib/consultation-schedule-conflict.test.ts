import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClientAdvisorBusySlots,
  findClientConsultationScheduleConflict,
} from "./consultation-schedule-conflict";

describe("client consultation schedule conflict", () => {
  it("CSC-C01 สร้าง busy จาก SCHEDULED และข้อเสนอรอตอบ", () => {
    const slots = buildClientAdvisorBusySlots({
      excludeRequestId: "cur",
      formatLabel: (iso) => iso,
      requests: [
        {
          id: "cur",
          status: "ACCEPTED",
          scheduledAt: null,
          studentName: "ปัจจุบัน",
          topic: "ท",
          latestPendingOffer: null,
        },
        {
          id: "s1",
          status: "SCHEDULED",
          scheduledAt: "2026-11-10T06:00:00.000Z",
          studentName: "เอ",
          topic: "เครียด",
        },
        {
          id: "p1",
          status: "ACCEPTED",
          scheduledAt: null,
          studentName: "บี",
          topic: "นอน",
          latestPendingOffer: {
            proposedAt: "2026-11-10T09:00:00.000Z",
            status: "PENDING",
            waitingOn: "STUDENT",
          },
        },
      ],
    });
    assert.equal(slots.length, 2);
    assert.equal(slots[0]?.source, "SCHEDULED");
    assert.equal(slots[1]?.source, "PENDING_OFFER");
  });

  it("CSC-C02 ตรวจทับช่วงบน client", () => {
    const slots = buildClientAdvisorBusySlots({
      excludeRequestId: "x",
      formatLabel: (iso) => iso,
      requests: [
        {
          id: "s1",
          status: "SCHEDULED",
          scheduledAt: "2026-11-10T06:00:00.000Z",
          studentName: "เอ",
          topic: "เครียด",
        },
      ],
    });
    const hit = findClientConsultationScheduleConflict(
      new Date("2026-11-10T06:45:00.000Z"),
      slots
    );
    assert.equal(hit.conflict, true);
    const ok = findClientConsultationScheduleConflict(
      new Date("2026-11-10T07:00:00.000Z"),
      slots
    );
    assert.equal(ok.conflict, false);
  });
});
