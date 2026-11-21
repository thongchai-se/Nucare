import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus, ReferralTarget } from "@prisma/client";
import {
  buildExecutiveReferralRoadmap,
  mapExecutiveReferralListItem,
  parseExecutiveReferralStudyYear,
  summarizeExecutiveReferralStats,
} from "./executive-referral-cases";

describe("parseExecutiveReferralStudyYear", () => {
  it("ERC-01 รับชั้นปี 1–4 และค่าอื่นเป็น ALL", () => {
    assert.equal(parseExecutiveReferralStudyYear("2"), 2);
    assert.equal(parseExecutiveReferralStudyYear("ALL"), "ALL");
    assert.equal(parseExecutiveReferralStudyYear("9"), "ALL");
    assert.equal(parseExecutiveReferralStudyYear(undefined), "ALL");
  });
});

describe("summarizeExecutiveReferralStats", () => {
  it("ERC-02 นับสถานะ เร่งด่วน และปลายทางแบบ O(n)", () => {
    const stats = summarizeExecutiveReferralStats([
      {
        status: ReferralStatus.PENDING,
        target: ReferralTarget.COUNSELING_CENTER,
        isUrgent: true,
      },
      {
        status: ReferralStatus.ACCEPTED,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        isUrgent: false,
      },
      {
        status: ReferralStatus.CLOSED,
        target: ReferralTarget.COUNSELING_CENTER,
        isUrgent: true,
      },
    ]);

    assert.equal(stats.total, 3);
    assert.equal(stats.pending, 1);
    assert.equal(stats.accepted, 1);
    assert.equal(stats.closed, 1);
    assert.equal(stats.urgentOpen, 1);
    assert.equal(stats.byTarget[0]?.target, ReferralTarget.COUNSELING_CENTER);
    assert.equal(stats.byTarget[0]?.count, 2);
  });
});

describe("buildExecutiveReferralRoadmap", () => {
  it("ERC-03 แสดงเส้นทางส่งต่อ→รับ→ปิด พร้อมเหตุผลปิด", () => {
    const steps = buildExecutiveReferralRoadmap({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      status: ReferralStatus.CLOSED,
      advisorName: "อ.ส่ง",
      target: ReferralTarget.COUNSELING_CENTER,
      reason: "ต้องการดูแลต่อ",
      isUrgent: false,
      acceptedAt: new Date("2026-01-02T00:00:00.000Z"),
      acceptedByName: "อ.รับ",
      closedAt: new Date("2026-01-10T00:00:00.000Z"),
      closedReason: "ดูแลครบแล้ว",
      careSessionCount: 1,
      latestCareSessionAt: new Date("2026-01-05T00:00:00.000Z"),
      latestCareProviderName: "อ.รับ",
    });

    assert.equal(steps[0]?.kind, "sent");
    assert.match(steps[0]?.detail ?? "", /อ\.ส่ง|ศูนย์ให้คำปรึกษา|ต้องการดูแลต่อ/);
    assert.equal(steps.some((step) => step.kind === "accepted"), true);
    assert.equal(steps.some((step) => step.kind === "care"), true);
    const closed = steps.find((step) => step.kind === "closed");
    assert.ok(closed);
    assert.match(closed?.detail ?? "", /ดูแลครบแล้ว/);
  });
});

describe("mapExecutiveReferralListItem", () => {
  it("ERC-04 แมปผู้ส่ง/ผู้รับ/บันทึก และไม่รั่วข้อความว่าง", () => {
    const item = mapExecutiveReferralListItem(
      {
        id: "ref-1",
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        status: ReferralStatus.ACCEPTED,
        isUrgent: true,
        reason: "ส่งต่อสวัสดิการ",
        staffNote: "  ติดตามทุนแล้ว  ",
        closedReason: null,
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
        updatedAt: new Date("2026-02-02T00:00:00.000Z"),
        student: {
          id: "stu-1",
          name: "นิสิต ตัวอย่าง",
          studentId: "681100001-1",
          studyYear: 1,
        },
        advisor: { name: "ที่ปรึกษา 1" },
        acceptedBy: { name: "SD 1" },
        specializedCareRecords: [],
        _count: { specializedCareRecords: 0 },
      },
      new Date("2026-02-02T00:00:00.000Z"),
      "SD 1"
    );

    assert.equal(item.advisorName, "ที่ปรึกษา 1");
    assert.equal(item.acceptedByName, "SD 1");
    assert.equal(item.currentOwnerName, "SD 1");
    assert.equal(item.targetLabel, "งานพัฒนานิสิต");
    assert.equal(item.staffNote, "ติดตามทุนแล้ว");
    assert.equal(item.closedReason, null);
    assert.equal(item.roadmap[0]?.actorName, "ที่ปรึกษา 1");
  });
});
