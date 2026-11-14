import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveOfficialToken,
  formatOfficialRecordCode,
  formatOfficialTargetCode,
  isInternalOpaqueId,
} from "./official-ref";

describe("official-ref", () => {
  it("OR-01 ไม่ใช้รูปแบบตัดทับ CUID", () => {
    const code = formatOfficialRecordCode({
      id: "cmwdaeveq00a4ay2cv7ros5wd",
      kind: "AUD",
      createdAt: "2026-11-12T08:29:00.000Z",
    });

    assert.match(code, /^AUD-\d{8}-[2-9A-HJ-NP-Z]{6}$/);
    assert.doesNotMatch(code, /cmw/i);
    assert.doesNotMatch(code, /…|\.\.\./);
  });

  it("OR-02 โทเคนคงที่เมื่อรหัสเดิมเหมือนกัน", () => {
    const a = deriveOfficialToken("cmwdaeveq00a4ay2cv7ros5wd", 6);
    const b = deriveOfficialToken("cmwdaeveq00a4ay2cv7ros5wd", 6);
    const c = deriveOfficialToken("cmwdadzpe009say2coplgjecm", 6);
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("OR-03 เป้าหมายใช้รหัสนักศึกษาแทน CUID", () => {
    assert.equal(
      formatOfficialTargetCode({
        entityId: "cmwbq4edj0002ayv4lt7czghc",
        entityType: "User",
        studentId: "663380696-6",
      }),
      "663380696-6"
    );
  });

  it("OR-04 เป้าหมายไม่มีรหัสภายนอก → เลขอ้างอิงทางการ", () => {
    const code = formatOfficialTargetCode({
      entityId: "cmwbq4edj0002ayv4lt7czghc",
      entityType: "User",
      createdAt: "2026-11-12T08:28:00.000Z",
    });
    assert.match(code, /^USR-\d{8}-[2-9A-HJ-NP-Z]{6}$/);
    assert.equal(isInternalOpaqueId("cmwbq4edj0002ayv4lt7czghc"), true);
    assert.equal(isInternalOpaqueId("663380696-6"), false);
  });
});
