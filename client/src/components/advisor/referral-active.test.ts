import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasActiveReferral, pickReferralForStudent } from "./referral-active";
import type { AdvisorReferralItem } from "./types";

const base = {
  studentName: "นศ",
  studentCode: null,
  year: "2",
  target: "COUNSELING_CENTER" as const,
  reason: "x",
  isUrgent: false,
  createdAt: "2026-11-02T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
  currentOwnerName: null,
  currentOwnerAssignedAt: null,
  careSessionCount: 0,
  latestCareSessionAt: null,
};

describe("hasActiveReferral", () => {
  it("blocks PENDING and ACCEPTED (กำลังดูแล)", () => {
    assert.equal(hasActiveReferral("PENDING"), true);
    assert.equal(hasActiveReferral("ACCEPTED"), true);
  });

  it("allows CLOSED or missing", () => {
    assert.equal(hasActiveReferral("CLOSED"), false);
    assert.equal(hasActiveReferral(undefined), false);
    assert.equal(hasActiveReferral(null), false);
  });
});

describe("pickReferralForStudent", () => {
  it("prefers open referral over newer CLOSED", () => {
    const referrals: AdvisorReferralItem[] = [
      { ...base, id: "closed-new", studentId: "s1", status: "CLOSED" },
      { ...base, id: "accepted-old", studentId: "s1", status: "ACCEPTED" },
    ];
    const picked = pickReferralForStudent(referrals, "s1");
    assert.equal(picked?.id, "accepted-old");
    assert.equal(hasActiveReferral(picked?.status), true);
  });
});
