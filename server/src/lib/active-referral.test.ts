import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus, ReferralTarget } from "@prisma/client";
import {
  ACTIVE_REFERRAL_STATUSES,
  activeReferralConflictMessage,
  isActiveReferralStatus,
  shouldBlockReferralForTarget,
} from "./active-referral";

describe("isActiveReferralStatus", () => {
  it("PENDING and ACCEPTED are active", () => {
    assert.equal(isActiveReferralStatus(ReferralStatus.PENDING), true);
    assert.equal(isActiveReferralStatus(ReferralStatus.ACCEPTED), true);
  });

  it("CLOSED is not active", () => {
    assert.equal(isActiveReferralStatus(ReferralStatus.CLOSED), false);
  });

  it("ACTIVE_REFERRAL_STATUSES lists open states only", () => {
    assert.deepEqual(ACTIVE_REFERRAL_STATUSES, ["PENDING", "ACCEPTED"]);
  });

  it("conflict message matches status", () => {
    assert.match(activeReferralConflictMessage(ReferralStatus.PENDING), /รอรับเคส/);
    assert.match(activeReferralConflictMessage(ReferralStatus.ACCEPTED), /กำลังดูแล/);
    assert.match(
      activeReferralConflictMessage(ReferralStatus.PENDING, ReferralTarget.STUDENT_DEVELOPMENT),
      /รอประสานงาน/
    );
    assert.match(
      activeReferralConflictMessage(ReferralStatus.ACCEPTED, ReferralTarget.STUDENT_DEVELOPMENT),
      /กำลังประสานงาน/
    );
  });
});

describe("shouldBlockReferralForTarget", () => {
  it("AR-T01 คนละ target ไม่บล็อก", () => {
    assert.equal(
      shouldBlockReferralForTarget({
        existingTarget: ReferralTarget.STUDENT_DEVELOPMENT,
        requestedTarget: ReferralTarget.COUNSELING_CENTER,
      }),
      false
    );
  });

  it("AR-T02 target เดียวกันบล็อก", () => {
    assert.equal(
      shouldBlockReferralForTarget({
        existingTarget: ReferralTarget.COUNSELING_CENTER,
        requestedTarget: ReferralTarget.COUNSELING_CENTER,
      }),
      true
    );
  });
});
