import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralTarget } from "@prisma/client";
import { REFERRAL_TARGET_LABEL, referralTargetLabel } from "./referral-labels";

describe("referral-labels", () => {
  it("RL-01 ป้ายปลายทางศูนย์และงานพัฒนานิสิตคงที่", () => {
    assert.equal(REFERRAL_TARGET_LABEL.COUNSELING_CENTER, "ศูนย์ให้คำปรึกษา");
    assert.equal(REFERRAL_TARGET_LABEL.STUDENT_DEVELOPMENT, "งานพัฒนานิสิต");
    assert.equal(referralTargetLabel(ReferralTarget.COUNSELING_CENTER), "ศูนย์ให้คำปรึกษา");
    assert.equal(referralTargetLabel(ReferralTarget.STUDENT_DEVELOPMENT), "งานพัฒนานิสิต");
  });
});
