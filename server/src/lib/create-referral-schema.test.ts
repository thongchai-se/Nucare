import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralTarget } from "@prisma/client";
import { createReferralSchema } from "../controllers/advisor.controller";

describe("createReferralSchema reason length", () => {
  it("CRS-01 รับเหตุผลสั้น ๆ อย่างน้อย 1 ตัวอักษรหลัง trim", () => {
    const parsed = createReferralSchema.safeParse({
      target: ReferralTarget.STUDENT_DEVELOPMENT,
      reason: "เครียด",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.reason, "เครียด");
    }
  });

  it("CRS-02 ปฏิเสธเหตุผลว่างหรือมีแต่ช่องว่าง", () => {
    for (const reason of ["", "   ", "\n\t"]) {
      const parsed = createReferralSchema.safeParse({
        target: ReferralTarget.COUNSELING_CENTER,
        reason,
      });
      assert.equal(parsed.success, false, `ต้องปฏิเสธ reason=${JSON.stringify(reason)}`);
    }
  });

  it("CRS-03 ไม่บังคับความยาว 20 ตัวอักษรอีกต่อไป", () => {
    const short = createReferralSchema.safeParse({
      target: ReferralTarget.COUNSELING_CENTER,
      reason: "อยากให้ช่วยดู",
    });
    assert.equal(short.success, true);
    assert.ok((short.success ? short.data.reason.length : 0) < 20);
  });
});
