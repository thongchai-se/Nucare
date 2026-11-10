import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countNegotiateLanes,
  getNegotiateLane,
  isUpcomingAppointment,
  sortAcceptedNegotiations,
  sortScheduledByAppointment,
} from "./consultation-negotiate";
import type { AdvisorConsultationRequestItem } from "./types";

function baseRequest(
  overrides: Partial<AdvisorConsultationRequestItem> & Pick<AdvisorConsultationRequestItem, "id" | "status">
): AdvisorConsultationRequestItem {
  return {
    studentId: "s1",
    studentName: "นิสิต",
    studentCode: "681100001-1",
    year: "2",
    topic: "การเรียนและผลการเรียน",
    preferredChannel: "IN_PERSON",
    preferredChannelLabel: "พบที่คณะ",
    note: null,
    advisorNote: null,
    scheduledAt: null,
    scheduleLocation: null,
    acceptedAt: null,
    closedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    alertId: null,
    latestPendingOffer: null,
    ...overrides,
  };
}

describe("consultation-negotiate", () => {
  it("แยกเลนเจรจานัดตาม waitingOn", () => {
    assert.equal(
      getNegotiateLane(
        baseRequest({
          id: "a",
          status: "ACCEPTED",
          latestPendingOffer: {
            id: "o1",
            proposedAt: "2026-11-05T10:00:00.000Z",
            location: "ห้อง A",
            note: null,
            status: "PENDING",
            createdAt: "2026-11-01T00:00:00.000Z",
            proposedById: "st",
            proposedByName: "นิสิต",
            proposedByRole: "STUDENT",
            waitingOn: "ADVISOR",
          },
        })
      ),
      "waiting_advisor"
    );
    assert.equal(
      getNegotiateLane(
        baseRequest({
          id: "b",
          status: "ACCEPTED",
          latestPendingOffer: {
            id: "o2",
            proposedAt: "2026-11-05T10:00:00.000Z",
            location: "ห้อง A",
            note: null,
            status: "PENDING",
            createdAt: "2026-11-01T00:00:00.000Z",
            proposedById: "ad",
            proposedByName: "อาจารย์",
            proposedByRole: "ADVISOR",
            waitingOn: "STUDENT",
          },
        })
      ),
      "waiting_student"
    );
    assert.equal(getNegotiateLane(baseRequest({ id: "c", status: "ACCEPTED" })), "no_offer");
  });

  it("เรียง ACCEPTED ให้รออาจารย์ขึ้นก่อน", () => {
    const sorted = sortAcceptedNegotiations([
      baseRequest({ id: "student", status: "ACCEPTED", updatedAt: "2026-11-03T00:00:00.000Z", latestPendingOffer: {
        id: "o", proposedAt: "2026-11-05T10:00:00.000Z", location: "A", note: null, status: "PENDING",
        createdAt: "2026-11-01T00:00:00.000Z", proposedById: "ad", proposedByName: "อ", proposedByRole: "ADVISOR", waitingOn: "STUDENT",
      }}),
      baseRequest({ id: "none", status: "ACCEPTED", updatedAt: "2026-11-04T00:00:00.000Z" }),
      baseRequest({ id: "advisor", status: "ACCEPTED", updatedAt: "2026-11-02T00:00:00.000Z", latestPendingOffer: {
        id: "o2", proposedAt: "2026-11-05T10:00:00.000Z", location: "A", note: null, status: "PENDING",
        createdAt: "2026-11-01T00:00:00.000Z", proposedById: "st", proposedByName: "น", proposedByRole: "STUDENT", waitingOn: "ADVISOR",
      }}),
    ]);
    assert.deepEqual(sorted.map((item) => item.id), ["advisor", "none", "student"]);
  });

  it("เรียง SCHEDULED ตามวันนัดใกล้ถึงก่อน", () => {
    const sorted = sortScheduledByAppointment([
      baseRequest({ id: "later", status: "SCHEDULED", scheduledAt: "2026-11-20T10:00:00.000Z" }),
      baseRequest({ id: "sooner", status: "SCHEDULED", scheduledAt: "2026-11-05T10:00:00.000Z" }),
      baseRequest({ id: "missing", status: "SCHEDULED", scheduledAt: null }),
    ]);
    assert.deepEqual(sorted.map((item) => item.id), ["sooner", "later", "missing"]);
  });

  it("นับเลนและจับนัดใกล้ถึงใน 7 วัน", () => {
    const counts = countNegotiateLanes([
      baseRequest({ id: "1", status: "ACCEPTED" }),
      baseRequest({
        id: "2",
        status: "ACCEPTED",
        latestPendingOffer: {
          id: "o", proposedAt: "2026-11-05T10:00:00.000Z", location: "A", note: null, status: "PENDING",
          createdAt: "2026-11-01T00:00:00.000Z", proposedById: "st", proposedByName: "น", proposedByRole: "STUDENT", waitingOn: "ADVISOR",
        },
      }),
      baseRequest({ id: "3", status: "PENDING" }),
    ]);
    assert.deepEqual(counts, { waitingAdvisor: 1, waitingStudent: 0, noOffer: 1 });

    const now = new Date("2026-11-04T08:00:00.000Z");
    assert.equal(
      isUpcomingAppointment(
        baseRequest({ id: "u", status: "SCHEDULED", scheduledAt: "2026-11-06T10:00:00.000Z" }),
        now
      ),
      true
    );
    assert.equal(
      isUpcomingAppointment(
        baseRequest({ id: "f", status: "SCHEDULED", scheduledAt: "2026-12-01T10:00:00.000Z" }),
        now
      ),
      false
    );
  });
});
