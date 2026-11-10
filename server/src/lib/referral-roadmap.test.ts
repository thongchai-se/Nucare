import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildReferralRoadmap } from "./referral-roadmap";

describe("buildReferralRoadmap", () => {
  it("PENDING only has sent step", () => {
    const steps = buildReferralRoadmap({
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      status: "PENDING",
      advisorName: "อ.ทดสอบ",
      targetLabel: "ทีมสุขภาพจิต",
      reason: "ติดตามเครียด",
      isUrgent: false,
      careSessionCount: 0,
    });
    assert.equal(steps.length, 1);
    assert.equal(steps[0]?.kind, "sent");
  });

  it("ACCEPTED adds accept pin and optional care", () => {
    const steps = buildReferralRoadmap({
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      status: "ACCEPTED",
      advisorName: "อ.ทดสอบ",
      targetLabel: "ทีมสุขภาพจิต",
      reason: "ติดตามเครียด",
      isUrgent: true,
      acceptedAt: new Date("2026-11-01T12:00:00.000Z"),
      acceptedByName: "อ.สุขภาพจิต",
      careSessionCount: 1,
      latestCareSessionAt: new Date("2026-11-02T09:00:00.000Z"),
      latestCareProviderName: "อ.สุขภาพจิต",
    });
    assert.deepEqual(
      steps.map((step) => step.kind),
      ["sent", "accepted", "care"]
    );
  });

  it("CLOSED ends with closed pin", () => {
    const steps = buildReferralRoadmap({
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
      status: "CLOSED",
      advisorName: "อ.ทดสอบ",
      targetLabel: "พัฒนานิสิต",
      reason: "ทุน",
      isUrgent: false,
      acceptedAt: new Date("2026-11-01T11:00:00.000Z"),
      closedAt: new Date("2026-11-03T08:00:00.000Z"),
      careSessionCount: 0,
    });
    assert.equal(steps.at(-1)?.kind, "closed");
  });
});
