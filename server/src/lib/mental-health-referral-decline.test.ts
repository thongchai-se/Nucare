import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeDeclinedUserIds,
  shouldCloseReferralAfterDeclines,
} from "./mental-health-referral-decline";

describe("mental-health referral decline (partial hide)", () => {
  it("MHD-01 ยังไม่ปิดเมื่อยังมีผู้เชี่ยวชาญที่ยังไม่ปฏิเสธ", () => {
    assert.equal(
      shouldCloseReferralAfterDeclines({
        activeExpertIds: ["e1", "e2", "e3"],
        declinedUserIds: ["e1"],
      }),
      false
    );
    assert.equal(
      shouldCloseReferralAfterDeclines({
        activeExpertIds: ["e1", "e2"],
        declinedUserIds: ["e1"],
      }),
      false
    );
  });

  it("MHD-02 ปิดเมื่อผู้เชี่ยวชาญที่ยังใช้งานปฏิเสธครบ", () => {
    assert.equal(
      shouldCloseReferralAfterDeclines({
        activeExpertIds: ["e1", "e2"],
        declinedUserIds: ["e2", "e1"],
      }),
      true
    );
    assert.equal(
      shouldCloseReferralAfterDeclines({
        activeExpertIds: ["e1"],
        declinedUserIds: ["e1"],
      }),
      true
    );
  });

  it("MHD-03 ไม่นับผู้เชี่ยวชาญที่ไม่ได้ใช้งานแล้ว และรวมรายการปฏิเสธไม่ซ้ำ", () => {
    assert.equal(
      shouldCloseReferralAfterDeclines({
        activeExpertIds: ["e2"],
        declinedUserIds: ["e1", "e2"],
      }),
      true
    );
    assert.equal(
      shouldCloseReferralAfterDeclines({
        activeExpertIds: [],
        declinedUserIds: ["e1"],
      }),
      true
    );
    assert.deepEqual(mergeDeclinedUserIds(["e1", "e1"], "e2").sort(), ["e1", "e2"]);
    assert.deepEqual(mergeDeclinedUserIds(["e1"], "e1"), ["e1"]);
  });
});
