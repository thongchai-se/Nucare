import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapConsultationScheduleOffer, pickLatestPendingOffer } from "./consultation-schedule-offers";

describe("consultation schedule offers", () => {
  it("marks waitingOn STUDENT when advisor proposes", () => {
    const dto = mapConsultationScheduleOffer(
      {
        id: "o1",
        proposedAt: new Date("2026-11-10T10:00:00.000Z"),
        location: "ห้องพักอาจารย์",
        note: null,
        status: "PENDING",
        createdAt: new Date("2026-11-02T08:00:00.000Z"),
        proposedById: "adv-1",
        proposedBy: { id: "adv-1", name: "อ.ทดสอบ" },
      },
      "stu-1",
      "adv-1"
    );
    assert.equal(dto.proposedByRole, "ADVISOR");
    assert.equal(dto.waitingOn, "STUDENT");
  });

  it("marks waitingOn ADVISOR when student counters", () => {
    const dto = mapConsultationScheduleOffer(
      {
        id: "o2",
        proposedAt: new Date("2026-11-11T10:00:00.000Z"),
        location: "ออนไลน์",
        note: "ขอเลื่อน",
        status: "PENDING",
        createdAt: new Date("2026-11-02T09:00:00.000Z"),
        proposedById: "stu-1",
        proposedBy: { id: "stu-1", name: "นิสิต" },
      },
      "stu-1",
      "adv-1"
    );
    assert.equal(dto.proposedByRole, "STUDENT");
    assert.equal(dto.waitingOn, "ADVISOR");
  });

  it("pickLatestPendingOffer returns newest pending", () => {
    const latest = pickLatestPendingOffer([
      { id: "a", status: "SUPERSEDED", createdAt: new Date("2026-11-01T10:00:00.000Z") },
      { id: "b", status: "PENDING", createdAt: new Date("2026-11-01T12:00:00.000Z") },
      { id: "c", status: "PENDING", createdAt: new Date("2026-11-01T11:00:00.000Z") },
    ]);
    assert.equal(latest?.id, "b");
  });
});
