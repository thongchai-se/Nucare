import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  referralStatusBadgeClass,
  STATUS_BADGE_COMPACT,
  URGENT_BADGE_CLASS,
} from "./status-badge";

describe("status-badge helpers", () => {
  it("SB-01 คืนคลาสสถานะ referral ตามขั้น", () => {
    assert.match(referralStatusBadgeClass("PENDING"), /amber/);
    assert.match(referralStatusBadgeClass("ACCEPTED"), /0057A8|#0057A8|bg-\[#0057A8\]/);
    assert.match(referralStatusBadgeClass("CLOSED"), /emerald/);
  });

  it("SB-02 รูปทรงแบดจ์กะทัดรัดและเร่งด่วนไม่ว่าง", () => {
    assert.match(STATUS_BADGE_COMPACT, /rounded-md/);
    assert.match(URGENT_BADGE_CLASS, /red/);
  });
});
