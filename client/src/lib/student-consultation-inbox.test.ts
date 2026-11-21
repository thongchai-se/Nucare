import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildUpcomingAppointmentPreview,
  countStudentActionQueue,
  countStudentDashboardActions,
  hasOpenStudentConsultation,
  isAwaitingStudentResponse,
  isUpcomingStudentConsultation,
  listAwaitingStudentResponses,
  listUpcomingConsultations,
  resolveAppointmentLocation,
  sanitizeStudentFacingNote,
  splitChatPeersByCareTeam,
} from "./student-consultation-inbox";
import type { StudentConsultationRequest } from "./student-dashboard";

function baseRequest(
  overrides: Partial<StudentConsultationRequest> & Pick<StudentConsultationRequest, "id" | "status">
): StudentConsultationRequest {
  return {
    topic: "สุขภาพใจและความเครียด",
    preferredChannel: "ONLINE",
    preferredChannelLabel: "ออนไลน์",
    note: null,
    advisorNote: null,
    scheduledAt: null,
    scheduleLocation: null,
    acceptedAt: null,
    closedAt: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    alertId: null,
    teacher: {
      id: "t1",
      name: "อ.ดร. สุภาวดี",
      employeeId: "ADV-TEST-001",
      image: null,
      initials: "สท",
      roleLabels: ["อาจารย์ที่ปรึกษา"],
      isAssignedAdvisor: true,
    },
    latestPendingOffer: null,
    ...overrides,
  };
}

describe("student-consultation-inbox", () => {
  it("จับข้อเสนอที่รอให้นิสิตตอบ", () => {
    assert.equal(
      isAwaitingStudentResponse(
        baseRequest({
          id: "a",
          status: "ACCEPTED",
          latestPendingOffer: {
            id: "o1",
            proposedAt: "2026-11-05T10:00:00.000Z",
            location: "ห้อง A",
            note: null,
            status: "PENDING",
            createdAt: "2026-11-02T00:00:00.000Z",
            proposedById: "ad",
            proposedByName: "อาจารย์",
            proposedByRole: "ADVISOR",
            waitingOn: "STUDENT",
          },
        })
      ),
      true
    );
    assert.equal(
      isAwaitingStudentResponse(
        baseRequest({
          id: "b",
          status: "ACCEPTED",
          latestPendingOffer: {
            id: "o2",
            proposedAt: "2026-11-05T10:00:00.000Z",
            location: "ห้อง A",
            note: null,
            status: "PENDING",
            createdAt: "2026-11-02T00:00:00.000Z",
            proposedById: "st",
            proposedByName: "นิสิต",
            proposedByRole: "STUDENT",
            waitingOn: "ADVISOR",
          },
        })
      ),
      false
    );
  });

  it("เรียงรายการต้องตอบใหม่อยู่ก่อน", () => {
    const listed = listAwaitingStudentResponses([
      baseRequest({
        id: "old",
        status: "ACCEPTED",
        updatedAt: "2026-11-01T00:00:00.000Z",
        latestPendingOffer: {
          id: "o-old",
          proposedAt: "2026-11-05T10:00:00.000Z",
          location: "A",
          note: null,
          status: "PENDING",
          createdAt: "2026-11-01T00:00:00.000Z",
          proposedById: "ad",
          proposedByName: "อาจารย์",
          proposedByRole: "ADVISOR",
          waitingOn: "STUDENT",
        },
      }),
      baseRequest({
        id: "new",
        status: "SCHEDULED",
        updatedAt: "2026-11-03T00:00:00.000Z",
        latestPendingOffer: {
          id: "o-new",
          proposedAt: "2026-11-06T10:00:00.000Z",
          location: "B",
          note: null,
          status: "PENDING",
          createdAt: "2026-11-03T00:00:00.000Z",
          proposedById: "ad",
          proposedByName: "อาจารย์",
          proposedByRole: "ADVISOR",
          waitingOn: "STUDENT",
        },
      }),
      baseRequest({ id: "skip", status: "PENDING" }),
    ]);
    assert.deepEqual(
      listed.map((item) => item.id),
      ["new", "old"]
    );
  });

  it("จับและเรียงนัดใกล้ถึงภายใน 7 วัน", () => {
    const now = new Date("2026-11-04T10:00:00.000Z");
    assert.equal(
      isUpcomingStudentConsultation(
        baseRequest({
          id: "near",
          status: "SCHEDULED",
          scheduledAt: "2026-11-06T10:00:00.000Z",
        }),
        now
      ),
      true
    );
    assert.equal(
      isUpcomingStudentConsultation(
        baseRequest({
          id: "far",
          status: "SCHEDULED",
          scheduledAt: "2026-11-20T10:00:00.000Z",
        }),
        now
      ),
      false
    );

    const listed = listUpcomingConsultations(
      [
        baseRequest({
          id: "later",
          status: "SCHEDULED",
          scheduledAt: "2026-11-08T10:00:00.000Z",
        }),
        baseRequest({
          id: "sooner",
          status: "SCHEDULED",
          scheduledAt: "2026-11-05T10:00:00.000Z",
        }),
      ],
      now
    );
    assert.deepEqual(
      listed.map((item) => item.id),
      ["sooner", "later"]
    );
  });

  it("รวมนัดใกล้ถึงที่ปรึกษา+ผู้เชี่ยวชาญเรียงวันเวลาเหมือนกันทุกหน้า", () => {
    const now = new Date("2026-11-04T10:00:00.000Z");
    const preview = buildUpcomingAppointmentPreview(
      [
        baseRequest({
          id: "consult-later",
          status: "SCHEDULED",
          scheduledAt: "2026-11-08T10:00:00.000Z",
        }),
        baseRequest({
          id: "consult-soon",
          status: "SCHEDULED",
          scheduledAt: "2026-11-06T10:00:00.000Z",
        }),
      ],
      [
        {
          id: "mh-mid",
          scheduledAt: "2026-11-07T10:00:00.000Z",
          location: "ศูนย์ให้คำปรึกษา",
          providerName: "ทีมสุขภาพจิต",
        },
      ],
      now,
      3
    );
    assert.equal(preview.total, 3);
    assert.deepEqual(
      preview.items.map((item) => (item.kind === "mh" ? item.appointment.id : item.request.id)),
      ["consult-soon", "mh-mid", "consult-later"]
    );

    const counts = countStudentDashboardActions(
      [
        baseRequest({
          id: "consult-soon",
          status: "SCHEDULED",
          scheduledAt: "2026-11-06T10:00:00.000Z",
        }),
      ],
      [{ scheduledAt: "2026-11-07T10:00:00.000Z" }],
      now
    );
    assert.equal(counts.upcoming, 2);
  });

  it("นับคิวงานแบบ actionable ไม่ใช่ทุกสถานะที่ยังไม่ปิด", () => {
    const now = new Date("2026-11-04T10:00:00.000Z");
    const counts = countStudentActionQueue(
      [
        baseRequest({ id: "pending", status: "PENDING" }),
        baseRequest({
          id: "need-reply",
          status: "ACCEPTED",
          latestPendingOffer: {
            id: "o1",
            proposedAt: "2026-11-05T10:00:00.000Z",
            location: "A",
            note: null,
            status: "PENDING",
            createdAt: "2026-11-02T00:00:00.000Z",
            proposedById: "ad",
            proposedByName: "อาจารย์",
            proposedByRole: "ADVISOR",
            waitingOn: "STUDENT",
          },
        }),
        baseRequest({
          id: "upcoming",
          status: "SCHEDULED",
          scheduledAt: "2026-11-06T10:00:00.000Z",
          scheduleLocation: "ห้อง 2",
        }),
        baseRequest({
          id: "old-scheduled",
          status: "SCHEDULED",
          scheduledAt: "2026-10-01T10:00:00.000Z",
        }),
        baseRequest({ id: "closed", status: "CLOSED" }),
      ],
      now
    );
    assert.deepEqual(counts, { awaitingStudent: 1, waitingAdvisor: 1, upcoming: 1 });
  });

  it("เลือกสถานที่นัดและซ่อน DEMO-APPT จากโน้ต", () => {
    assert.equal(
      resolveAppointmentLocation(
        baseRequest({
          id: "loc",
          status: "SCHEDULED",
          scheduleLocation: "ห้องที่ปรึกษาชั้น 2",
          preferredChannelLabel: "ออนไลน์",
        })
      ),
      "ห้องที่ปรึกษาชั้น 2"
    );
    assert.equal(
      sanitizeStudentFacingNote("[DEMO-APPT] นัดยืนยันแล้ว — การ์ด «นัดหมายแล้ว»"),
      null
    );
    assert.equal(
      sanitizeStudentFacingNote("รายละเอียดจริง\n[DEMO-APPT] ซ่อนบรรทัดนี้"),
      "รายละเอียดจริง"
    );
  });

  it("ตรวจคำขอเปิดทีละรอบ", () => {
    assert.equal(
      hasOpenStudentConsultation([
        baseRequest({ id: "closed", status: "CLOSED" }),
        baseRequest({ id: "open", status: "SCHEDULED" }),
      ]),
      true
    );
    assert.equal(
      hasOpenStudentConsultation([baseRequest({ id: "only-closed", status: "CLOSED" })]),
      false
    );
    assert.equal(
      hasOpenStudentConsultation([baseRequest({ id: "cancelling", status: "CANCEL_REQUESTED" })]),
      true
    );
    assert.equal(
      hasOpenStudentConsultation([baseRequest({ id: "cancelled", status: "CANCELLED" })]),
      false
    );
  });

  it("แยก peer ในทีมดูแลออกจากรายชื่อทักหาอื่น", () => {
    const split = splitChatPeersByCareTeam(
      ["adv-1", "adv-2"],
      [{ id: "adv-1" }, { id: "mh-9" }, { id: "adv-2" }, { id: "sd-3" }]
    );
    assert.deepEqual([...split.chatableCareTeamIds].sort(), ["adv-1", "adv-2"]);
    assert.deepEqual(
      split.otherPeers.map((peer) => peer.id),
      ["mh-9", "sd-3"]
    );
    assert.deepEqual(splitChatPeersByCareTeam([], [{ id: "x" }]).otherPeers.map((p) => p.id), ["x"]);
    assert.equal(splitChatPeersByCareTeam(["a"], []).otherPeers.length, 0);
  });
});
