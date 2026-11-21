import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_DISPLAY_STATUS_FILTER_OPTIONS,
  getAuditDisplayStatusLabel,
  resolveAuditDisplayStatus,
} from "./audit-status";

describe("audit display status", () => {
  it("AS-01 เหตุความปลอดภัยแยกเป็น วิกฤต / สูง / เฝ้าระวัง", () => {
    assert.equal(
      resolveAuditDisplayStatus({ action: "security.privilege-probe" }),
      "Critical"
    );
    assert.equal(resolveAuditDisplayStatus({ action: "security.rate-limit" }), "High");
    assert.equal(resolveAuditDisplayStatus({ action: "auth.login.failed" }), "Watch");
    assert.equal(getAuditDisplayStatusLabel("Critical"), "วิกฤต");
    assert.equal(getAuditDisplayStatusLabel("High"), "สูง");
    assert.equal(getAuditDisplayStatusLabel("Watch"), "เฝ้าระวัง");
  });

  it("AS-02 กิจกรรมปกติและล้มเหลวทั่วไป", () => {
    assert.equal(resolveAuditDisplayStatus({ action: "auth.login.success" }), "Success");
    assert.equal(
      resolveAuditDisplayStatus({ action: "auth.password-change.failed" }),
      "Failed"
    );
    assert.equal(getAuditDisplayStatusLabel("Success"), "สำเร็จ");
    assert.equal(getAuditDisplayStatusLabel("Failed"), "ไม่สำเร็จ");
  });

  it("AS-03 ผลนำเข้า success / partial / failed", () => {
    assert.equal(
      resolveAuditDisplayStatus({
        action: "admin.student.import",
        description: "outcome=success created=10 failed=0",
      }),
      "Success"
    );
    assert.equal(
      resolveAuditDisplayStatus({
        action: "admin.student.import",
        description: "outcome=partial created=8 failed=2",
      }),
      "Partial"
    );
    assert.equal(
      resolveAuditDisplayStatus({
        action: "admin.user.import",
        description: "created=0 updated=0 skipped=0 failed=5",
      }),
      "Failed"
    );
    assert.equal(getAuditDisplayStatusLabel("Partial"), "สำเร็จบางส่วน");
  });

  it("AS-04 ตัวกรองมีครบ 6 ประเภท รวมเฝ้าระวังและวิกฤต", () => {
    const values = AUDIT_DISPLAY_STATUS_FILTER_OPTIONS.map((item) => item.value);
    assert.deepEqual(values, ["Success", "Partial", "Failed", "Watch", "High", "Critical"]);
    assert.ok(AUDIT_DISPLAY_STATUS_FILTER_OPTIONS.some((item) => item.label === "เฝ้าระวัง"));
    assert.ok(AUDIT_DISPLAY_STATUS_FILTER_OPTIONS.some((item) => item.label === "วิกฤต"));
    assert.ok(AUDIT_DISPLAY_STATUS_FILTER_OPTIONS.some((item) => item.label === "สูง"));
  });
});
