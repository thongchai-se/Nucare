import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus } from "@prisma/client";
import { shouldRequireClosedReason } from "./student-development-welfare-note";

describe("SD welfare note rules", () => {
  it("SDN-01 ปิดเคสโดยไม่มีเหตุผลควรถามเพิ่ม", () => {
    assert.equal(shouldRequireClosedReason(ReferralStatus.CLOSED, undefined), true);
    assert.equal(shouldRequireClosedReason(ReferralStatus.CLOSED, "  "), true);
  });

  it("SDN-02 รับเคสไม่บังคับเหตุผลปิด", () => {
    assert.equal(shouldRequireClosedReason(ReferralStatus.ACCEPTED, undefined), false);
  });

  it("SDN-03 มีเหตุผลปิดแล้วไม่บังคับซ้ำ", () => {
    assert.equal(shouldRequireClosedReason(ReferralStatus.CLOSED, "ช่วยเหลือครบแล้ว"), false);
  });
});
