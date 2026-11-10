import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus } from "@prisma/client";
import {
  canTransitionMentalHealthReferralStatus,
  mentalHealthReferralTransitionError,
} from "./mental-health-referral-status";

describe("mental-health referral status transitions", () => {
  it("MHR-01 รับคิว PENDING → ACCEPTED", () => {
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.PENDING, ReferralStatus.ACCEPTED),
      true
    );
  });

  it("MHR-02 ปฏิเสธคิว PENDING → CLOSED", () => {
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.PENDING, ReferralStatus.CLOSED),
      true
    );
  });

  it("MHR-03 ปิดเคส ACCEPTED → CLOSED", () => {
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.ACCEPTED, ReferralStatus.CLOSED),
      true
    );
  });

  it("MHR-04 ห้ามเปิดเคสใหม่จาก CLOSED และห้ามข้ามกลับ ACCEPTED", () => {
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.CLOSED, ReferralStatus.ACCEPTED),
      false
    );
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.CLOSED, ReferralStatus.PENDING),
      false
    );
    assert.equal(
      canTransitionMentalHealthReferralStatus(ReferralStatus.ACCEPTED, ReferralStatus.PENDING),
      false
    );
    assert.match(
      mentalHealthReferralTransitionError(ReferralStatus.CLOSED, ReferralStatus.ACCEPTED),
      /ปิดแล้ว/
    );
  });
});
