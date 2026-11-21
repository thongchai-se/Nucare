import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MentalHealthAppointmentStatus } from "@prisma/client";
import {
  includesClinicalCareContent,
  includesScreeningHistory,
  mergeMentalHealthHistoryActivity,
  shapeTriageStudentCard,
} from "./mental-health-student-history";
import type { SensitiveStudentCard } from "./sensitive-student-detail";

describe("MH history access shaping", () => {
  it("MHH-02 คิว triage ได้ประวัติคัดกรอง แต่ยังไม่เปิดเนื้อหาคลินิก", () => {
    assert.equal(includesScreeningHistory("triage"), true);
    assert.equal(includesScreeningHistory("clinical"), true);
    assert.equal(includesScreeningHistory("none"), false);
    assert.equal(includesClinicalCareContent("triage"), false);
    assert.equal(includesClinicalCareContent("clinical"), true);
  });

  it("MHH-03 การ์ด triage คงคะแนน/ความเสี่ยง แต่ตัดช่องทางติดต่อ", () => {
    const card = {
      id: "s1",
      name: "นิสิต",
      studentId: "681100001-1",
      year: "1",
      email: "a@example.com",
      phone: "0811111111",
      guardianPhone: "0822222222",
      riskLevel: "high",
      latestScore: 42,
      latestInstrument: "GHQ-28",
      wellnessSignals: [{ id: "w1" }],
      hasCrisisWellnessSignal: true,
    } as unknown as SensitiveStudentCard;

    const shaped = shapeTriageStudentCard(card);
    assert.equal(shaped.latestScore, 42);
    assert.equal(shaped.latestInstrument, "GHQ-28");
    assert.equal(shaped.riskLevel, "high");
    assert.equal(shaped.hasCrisisWellnessSignal, true);
    assert.equal(shaped.phone, null);
    assert.equal(shaped.email, null);
    assert.equal(shaped.guardianPhone, null);
  });
});

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
