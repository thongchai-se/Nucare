import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConsultationRequestStatus,
  EmergencyCaseStatus,
  ReferralStatus,
  ReferralTarget,
  RiskLevel,
} from "@prisma/client";
import {
  aggregateConsultationsByTeacher,
  buildExecutiveActivityTimeline,
  summarizeEmergencies,
  summarizeReferrals,
} from "./executive-student-dossier";

describe("aggregateConsultationsByTeacher", () => {
  it("ESD-01 รวมจำนวนครั้งต่ออาจารย์และแยกสถานะเปิด/ปิด", () => {
    const rows = [
      {
        id: "c1",
        teacherId: "t1",
        teacherName: "อ.หนึ่ง",
        topic: "เรียน",
        status: ConsultationRequestStatus.CLOSED,
        createdAt: new Date("2026-01-01"),
      },
      {
        id: "c2",
        teacherId: "t1",
        teacherName: "อ.หนึ่ง",
        topic: "เครียด",
        status: ConsultationRequestStatus.SCHEDULED,
        createdAt: new Date("2026-03-01"),
      },
      {
        id: "c3",
        teacherId: "t2",
        teacherName: "อ.สอง",
        topic: "งาน",
        status: ConsultationRequestStatus.PENDING,
        createdAt: new Date("2026-02-01"),
      },
    ];

    const result = aggregateConsultationsByTeacher(rows);
    assert.equal(result.length, 2);
    assert.equal(result[0]?.teacherId, "t1");
    assert.equal(result[0]?.totalCount, 2);
    assert.equal(result[0]?.openCount, 1);
    assert.equal(result[0]?.closedCount, 1);
    assert.equal(result[0]?.lastRequestedAt, new Date("2026-03-01").toISOString());
    assert.equal(result[1]?.teacherId, "t2");
    assert.equal(result[1]?.totalCount, 1);
    assert.equal(result[1]?.openCount, 1);
  });
});

describe("summarizeReferrals / summarizeEmergencies", () => {
  it("ESD-02 นับ referral เปิด/ปิดและเร่งด่วน", () => {
    const summary = summarizeReferrals([
      {
        id: "r1",
        target: ReferralTarget.COUNSELING_CENTER,
        status: ReferralStatus.PENDING,
        isUrgent: true,
        advisorName: "อ.ก",
        createdAt: new Date("2026-04-01"),
      },
      {
        id: "r2",
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        status: ReferralStatus.CLOSED,
        isUrgent: false,
        advisorName: "อ.ข",
        createdAt: new Date("2026-03-01"),
      },
    ]);

    assert.equal(summary.total, 2);
    assert.equal(summary.open, 1);
    assert.equal(summary.closed, 1);
    assert.equal(summary.urgentOpen, 1);
    assert.equal(summary.recent[0]?.id, "r1");
  });

  it("ESD-03 นับ SOS เปิด/ปิด", () => {
    const summary = summarizeEmergencies([
      {
        id: "e1",
        status: EmergencyCaseStatus.OPEN,
        summary: "ต้องการความช่วยเหลือ",
        openedAt: new Date("2026-05-01"),
        resolvedAt: null,
      },
      {
        id: "e2",
        status: EmergencyCaseStatus.RESOLVED,
        summary: "ปิดแล้ว",
        openedAt: new Date("2026-04-01"),
        resolvedAt: new Date("2026-04-02"),
      },
    ]);

    assert.equal(summary.total, 2);
    assert.equal(summary.open, 1);
    assert.equal(summary.resolved, 1);
  });
});

describe("buildExecutiveActivityTimeline", () => {
  it("ESD-04 เรียงใหม่สุดก่อนและจำกัดจำนวน", () => {
    const activity = buildExecutiveActivityTimeline({
      consultations: [
        {
          id: "c1",
          teacherId: "t1",
          teacherName: "อ.หนึ่ง",
          topic: "ปรึกษา",
          status: ConsultationRequestStatus.CLOSED,
          createdAt: new Date("2026-01-10"),
        },
      ],
      referrals: [],
      cares: [],
      behaviors: [],
      emergencies: [
        {
          id: "e1",
          status: EmergencyCaseStatus.OPEN,
          summary: "SOS",
          openedAt: new Date("2026-02-10"),
          resolvedAt: null,
        },
      ],
      assessments: [
        {
          id: "a1",
          assessedAt: new Date("2026-03-10"),
          score: 40,
          instrument: "GHQ-28",
          riskLevel: RiskLevel.HIGH,
        },
      ],
      limit: 2,
    });

    assert.equal(activity.length, 2);
    assert.equal(activity[0]?.kind, "ASSESSMENT");
    assert.equal(activity[0]?.status, "เสี่ยงสูง");
    assert.equal(activity[1]?.kind, "EMERGENCY");
    assert.equal(activity[1]?.status, "เปิด");
  });
});
