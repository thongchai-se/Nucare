import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAdvisorBusySlots,
  CONSULTATION_SLOT_BUFFER_MS,
  findConsultationScheduleConflict,
} from "./consultation-schedule-conflict";

describe("consultation schedule conflict", () => {
  it("CSC-01 นัดห่างครบ 1 ชม. ไม่ทับ", () => {
    const busy = buildAdvisorBusySlots({
      excludeRequestId: "current",
      scheduled: [
        {
          id: "a",
          scheduledAt: new Date("2026-11-10T06:00:00.000Z"),
          studentName: "เอ",
          topic: "เครียด",
        },
      ],
      pendingOffers: [],
    });
    const ok = findConsultationScheduleConflict(
      new Date("2026-11-10T07:00:00.000Z"),
      busy
    );
    assert.equal(ok.conflict, false);
    assert.equal(CONSULTATION_SLOT_BUFFER_MS, 60 * 60 * 1000);
  });

  it("CSC-02 นัดในชั่วโมงเดียวกันถือว่าทับ", () => {
    const busy = buildAdvisorBusySlots({
      excludeRequestId: "current",
      scheduled: [
        {
          id: "a",
          scheduledAt: new Date("2026-11-10T06:00:00.000Z"),
          studentName: "เอ",
          topic: "เครียด",
        },
      ],
      pendingOffers: [],
    });
    const hit = findConsultationScheduleConflict(
      new Date("2026-11-10T06:30:00.000Z"),
      busy
    );
    assert.equal(hit.conflict, true);
    assert.match(hit.message ?? "", /ทับกับนัดอื่น/);
    assert.equal(hit.conflictingSlot?.requestId, "a");
  });

  it("CSC-03 ข้อเสนอรอตอบก็กันชน และข้าม request ปัจจุบัน", () => {
    const busy = buildAdvisorBusySlots({
      excludeRequestId: "current",
      scheduled: [
        {
          id: "current",
          scheduledAt: new Date("2026-11-10T06:00:00.000Z"),
          studentName: "ฉัน",
          topic: "เดิม",
        },
      ],
      pendingOffers: [
        {
          requestId: "other",
          proposedAt: new Date("2026-11-10T08:00:00.000Z"),
          studentName: "บี",
          topic: "นอนไม่หลับ",
        },
        {
          requestId: "current",
          proposedAt: new Date("2026-11-10T09:00:00.000Z"),
          studentName: "ฉัน",
          topic: "ข้อเสนอตัวเอง",
        },
      ],
    });
    assert.equal(busy.length, 1);
    assert.equal(busy[0]?.source, "PENDING_OFFER");

    const hit = findConsultationScheduleConflict(
      new Date("2026-11-10T08:15:00.000Z"),
      busy
    );
    assert.equal(hit.conflict, true);
    assert.match(hit.conflictingSlot?.label ?? "", /รอตอบ/);
  });
});
