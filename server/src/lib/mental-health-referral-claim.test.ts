import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus } from "@prisma/client";
import { canTransitionMentalHealthReferralStatus } from "./mental-health-referral-status";

describe("mental-health concurrent claim rules", () => {
  it("MHC-01 รับเคสได้เฉพาะจาก PENDING และปิดจาก ACCEPTED", () => {
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.PENDING, ReferralStatus.ACCEPTED),
      true
    );
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.ACCEPTED, ReferralStatus.ACCEPTED),
      false
    );
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.CLOSED, ReferralStatus.ACCEPTED),
      false
    );
  });
});
