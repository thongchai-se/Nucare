import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MentalHealthAppointmentStatus } from "@prisma/client";
import { mergeMentalHealthHistoryActivity } from "./mental-health-student-history";

describe("mergeMentalHealthHistoryActivity", () => {
  it("MHH-01 เรียงนัดและบันทึกผู้เชี่ยวชาญใหม่สุดก่อน", () => {
    const activity = mergeMentalHealthHistoryActivity({
      baseActivity: [
        {
          id: "assessment:1",
          kind: "ASSESSMENT",
          date: "2026-01-01T00:00:00.000Z",
          type: "ผลประเมิน",
          topic: "GHQ-28",
          status: "normal",
          actorName: "ระบบ",
          isUrgent: false,
        },
      ],
      careSessions: [
        {
          id: "c1",
          sessionDate: "2026-03-01T00:00:00.000Z",
          summary: "SOAP summary",
          interventionPlan: "Plan A",
          confidentialNotes: null,
          providerName: "อ.มาลี",
          referralId: "r1",
          createdAt: "2026-03-01T00:00:00.000Z",
        },
      ],
      appointments: [
        {
          id: "a1",
          studentId: "s1",
          studentName: "นิสิต",
          date: "2026-02-15",
          time: "10:00",
          location: "ห้องปรึกษา",
          note: "",
          status: MentalHealthAppointmentStatus.SCHEDULED,
          providerName: "อ.มาลี",
          scheduledAt: "2026-02-15T10:00:00.000Z",
          referralId: "r1",
        },
      ],
      limit: 10,
    });

    assert.equal(activity[0]?.id, "specialized:c1");
    assert.equal(activity[1]?.id, "mh-appointment:a1");
    assert.equal(activity[2]?.kind, "ASSESSMENT");
    assert.match(activity[0]?.type ?? "", /ผู้เชี่ยวชาญ/);
  });
});
