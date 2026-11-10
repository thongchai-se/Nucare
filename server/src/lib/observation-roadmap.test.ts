import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlertStatus } from "@prisma/client";
import { buildObservationRoadmap } from "./observation-roadmap";

describe("buildObservationRoadmap", () => {
  const createdAt = new Date("2026-10-29T01:00:00.000Z");

  it("starts with only the reported step when nothing happened yet", () => {
    const steps = buildObservationRoadmap({
      createdAt,
      alerts: [
        {
          id: "a1",
          status: AlertStatus.OPEN,
          updatedAt: createdAt,
          recipientName: "อ.ดร. สุภาวดี",
        },
      ],
    });

    assert.equal(steps.length, 1);
    assert.equal(steps[0]?.key, "reported");
    assert.equal(steps[0]?.label, "แจ้งข้อสังเกต");
    assert.equal(steps[0]?.kind, "reported");
  });

  it("appends acknowledge steps only after advisors act", () => {
    const steps = buildObservationRoadmap({
      createdAt,
      alerts: [
        {
          id: "a1",
          status: AlertStatus.ACKNOWLEDGED,
          updatedAt: new Date("2026-10-29T02:00:00.000Z"),
          acknowledgedAt: new Date("2026-10-29T02:00:00.000Z"),
          recipientName: "อ.ดร. สุภาวดี",
        },
        {
          id: "a2",
          status: AlertStatus.OPEN,
          updatedAt: createdAt,
          recipientName: "นางสาว อรอุมา",
        },
      ],
    });

    assert.deepEqual(
      steps.map((step) => step.label),
      ["แจ้งข้อสังเกต", "รับเรื่อง"]
    );
    assert.equal(steps[1]?.actorName, "อ.ดร. สุภาวดี");
    assert.equal(steps[1]?.kind, "acknowledged");
  });

  it("includes both ack and close when closed, with resolution detail", () => {
    const steps = buildObservationRoadmap({
      createdAt,
      alerts: [
        {
          id: "a1",
          status: AlertStatus.CLOSED,
          updatedAt: new Date("2026-10-29T04:00:00.000Z"),
          acknowledgedAt: new Date("2026-10-29T02:00:00.000Z"),
          closedAt: new Date("2026-10-29T04:00:00.000Z"),
          resolutionNote: "ส่งต่อจิตแพทย์แล้ว",
          recipientName: "นางสาว อรอุมา",
        },
      ],
    });

    assert.deepEqual(
      steps.map((step) => `${step.label}:${step.actorName || "-"}`),
      ["แจ้งข้อสังเกต:-", "รับเรื่อง:นางสาว อรอุมา", "ปิดเรื่อง:นางสาว อรอุมา"]
    );
    assert.match(steps[2]?.detail || "", /ส่งต่อจิตแพทย์แล้ว/);
  });

  it("appends referral steps even after close so the path can continue", () => {
    const steps = buildObservationRoadmap({
      createdAt,
      alerts: [
        {
          id: "a1",
          status: AlertStatus.CLOSED,
          updatedAt: new Date("2026-10-29T03:00:00.000Z"),
          acknowledgedAt: new Date("2026-10-29T02:00:00.000Z"),
          closedAt: new Date("2026-10-29T03:00:00.000Z"),
          resolutionNote: "ปิดติดตามฝั่งที่ปรึกษา",
          recipientName: "นางสาว อรอุมา",
        },
      ],
      referrals: [
        {
          id: "r1",
          createdAt: new Date("2026-10-29T05:00:00.000Z"),
          targetLabel: "ทีมสุขภาพจิต / จิตแพทย์",
          reason: "ต้องการประเมินเชิงลึก",
          advisorName: "อ.ดร. สุภาวดี",
          status: "PENDING",
        },
      ],
    });

    assert.deepEqual(
      steps.map((step) => step.kind),
      ["reported", "acknowledged", "closed", "referred"]
    );
    assert.equal(steps[3]?.label, "ส่งต่อ\nทีมสุขภาพจิต / จิตแพทย์");
    assert.match(steps[3]?.detail || "", /ต้องการประเมินเชิงลึก/);
  });

  it("collapses duplicate referrals to the same target into one pin", () => {
    const steps = buildObservationRoadmap({
      createdAt,
      alerts: [],
      referrals: [
        {
          id: "r1",
          createdAt: new Date("2026-11-02T04:45:00.000Z"),
          targetLabel: "ทีมสุขภาพจิต / จิตแพทย์",
          reason: "ครั้งแรก",
          advisorName: "อ.ดร. สุภาวดี",
          status: "ACCEPTED",
        },
        {
          id: "r2",
          createdAt: new Date("2026-11-02T07:20:00.000Z"),
          targetLabel: "ทีมสุขภาพจิต / จิตแพทย์",
          reason: "ควรโดนบล็อกเพราะมีเคสเปิดอยู่",
          advisorName: "อ.ดร. สุภาวดี",
          status: "PENDING",
        },
      ],
    });

    const referred = steps.filter((step) => step.kind === "referred");
    assert.equal(referred.length, 1);
    assert.equal(referred[0]?.label, "ส่งต่อ\nทีมสุขภาพจิต / จิตแพทย์");
    assert.match(referred[0]?.detail || "", /2 ครั้ง/);
    assert.match(referred[0]?.detail || "", /PENDING/);
  });
});
