import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus } from "@prisma/client";
import { decideWelfareClaim } from "./student-development-claim";

describe("student development welfare claim", () => {
  it("SDC-01 รับช่วงได้เมื่อ ACCEPTED ของคนอื่น", () => {
    assert.deepEqual(decideWelfareClaim(ReferralStatus.ACCEPTED, "sd-1", "sd-2"), {
      ok: true,
      alreadyOwner: false,
    });
  });

  it("SDC-02 ถ้าเป็นเจ้าของอยู่แล้วถือว่าสำเร็จแบบ alreadyOwner", () => {
    assert.deepEqual(decideWelfareClaim(ReferralStatus.ACCEPTED, "sd-1", "sd-1"), {
      ok: true,
      alreadyOwner: true,
    });
  });

  it("SDC-03 ปฏิเสธเมื่อยังไม่ใช่ ACCEPTED", () => {
    const pending = decideWelfareClaim(ReferralStatus.PENDING, null, "sd-1");
    assert.equal(pending.ok, false);
    const closed = decideWelfareClaim(ReferralStatus.CLOSED, "sd-1", "sd-2");
    assert.equal(closed.ok, false);
  });
});
