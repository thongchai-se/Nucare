import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapMentalHealthScheduleOffer,
  parseFutureMentalHealthSchedule,
  pickLatestPendingMentalHealthOffer,
  shouldBlockMentalHealthSchedulePropose,
} from "./mental-health-schedule-offers";

const baseOffer = {
  id: "offer-1",
  referralId: "referral-1",
  proposedAt: new Date("2026-11-20T03:00:00.000Z"),
  location: "ห้องให้คำปรึกษา 1",
  note: null,
  status: "PENDING" as const,
  createdAt: new Date("2026-11-15T02:00:00.000Z"),
  proposedById: "expert-1",
  proposedBy: { id: "expert-1", name: "ผู้เชี่ยวชาญ ก" },
};

describe("mental-health schedule offers", () => {
  it("MHSO-01 maps an expert offer as waiting on the student", () => {
    const dto = mapMentalHealthScheduleOffer(baseOffer, "student-1");

    assert.equal(dto.proposedByRole, "MENTAL_HEALTH");
    assert.equal(dto.waitingOn, "STUDENT");
    assert.equal(dto.referralId, "referral-1");
  });

  it("MHSO-02 maps a student counter as waiting on the expert", () => {
    const dto = mapMentalHealthScheduleOffer(
      {
        ...baseOffer,
        id: "offer-2",
        proposedById: "student-1",
        proposedBy: { id: "student-1", name: "นิสิต ก" },
      },
      "student-1"
    );

    assert.equal(dto.proposedByRole, "STUDENT");
    assert.equal(dto.waitingOn, "MENTAL_HEALTH");
  });

  it("MHSO-03 clears waitingOn after an offer is accepted", () => {
    const dto = mapMentalHealthScheduleOffer(
      { ...baseOffer, status: "ACCEPTED" },
      "student-1"
    );

    assert.equal(dto.waitingOn, null);
  });

  it("MHSO-04 picks the newest pending offer and ignores other statuses", () => {
    const latest = pickLatestPendingMentalHealthOffer([
      { id: "old", status: "PENDING", createdAt: "2026-11-15T01:00:00.000Z" },
      { id: "accepted", status: "ACCEPTED", createdAt: "2026-11-15T04:00:00.000Z" },
      { id: "new", status: "PENDING", createdAt: "2026-11-15T03:00:00.000Z" },
    ]);

    assert.equal(latest?.id, "new");
    assert.equal(pickLatestPendingMentalHealthOffer([]), null);
  });

  it("MHSO-05 accepts now or future and rejects invalid or past schedules", () => {
    const now = new Date("2026-11-15T03:00:00.000Z");

    assert.equal(
      parseFutureMentalHealthSchedule("2026-11-15T03:00:00.000Z", now)?.toISOString(),
      now.toISOString()
    );
    assert.equal(
      parseFutureMentalHealthSchedule("2026-11-15T04:00:00.000Z", now)?.toISOString(),
      "2026-11-15T04:00:00.000Z"
    );
    assert.equal(parseFutureMentalHealthSchedule("2026-11-15T02:59:59.999Z", now), null);
    assert.equal(parseFutureMentalHealthSchedule("not-a-date", now), null);
  });

  it("MHSO-06 blocks expert re-propose while waiting on student", () => {
    assert.equal(
      shouldBlockMentalHealthSchedulePropose({
        actor: "MENTAL_HEALTH",
        pendingWaitingOn: "STUDENT",
      }),
      true
    );
    assert.equal(
      shouldBlockMentalHealthSchedulePropose({
        actor: "MENTAL_HEALTH",
        pendingWaitingOn: "MENTAL_HEALTH",
      }),
      false
    );
    assert.equal(
      shouldBlockMentalHealthSchedulePropose({
        actor: "MENTAL_HEALTH",
        pendingWaitingOn: null,
      }),
      false
    );
    assert.equal(
      shouldBlockMentalHealthSchedulePropose({
        actor: "STUDENT",
        pendingWaitingOn: "STUDENT",
      }),
      false
    );
  });
});
