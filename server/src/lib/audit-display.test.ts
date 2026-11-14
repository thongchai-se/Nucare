import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAuditIpAddress,
  formatAuditLogRef,
  formatAuditTargetRef,
  humanizeAuditMetadata,
  resolveAuditActionDetail,
  resolveAuditActionLabel,
  resolveAuditTargetLabel,
} from "./audit-display";

describe("audit-display", () => {
  it("AD-01 เลขอ้างอิงบันทึกเป็นรหัสทางการ ไม่ใช่ CUID ตัดทับ", () => {
    const code = formatAuditLogRef("cmwdaeveq00a4ay2cv7ros5wd", "2026-11-12T08:29:00.000Z");
    assert.match(code, /^AUD-\d{8}-[2-9A-HJ-NP-Z]{6}$/);
    assert.doesNotMatch(code, /cmw/i);
    assert.doesNotMatch(code, /…|\.\.\./);
    assert.equal(formatAuditLogRef(null), "-");
  });

  it("AD-02 แปลง localhost IP ให้อ่านรู้เรื่อง", () => {
    assert.equal(formatAuditIpAddress("::1"), "localhost");
    assert.equal(formatAuditIpAddress("127.0.0.1"), "localhost");
    assert.equal(formatAuditIpAddress("::ffff:127.0.0.1"), "localhost");
    assert.equal(formatAuditIpAddress("::ffff:10.0.0.8"), "10.0.0.8");
    assert.equal(formatAuditIpAddress("203.0.113.10"), "203.0.113.10");
  });

  it("AD-03 แปลกิจกรรม assessment-history ที่เคยโชว์รหัสดิบ", () => {
    assert.equal(
      resolveAuditActionLabel("advisor.assessment-history.view"),
      "เปิดดูประวัติผลประเมิน"
    );
    assert.equal(
      resolveAuditActionDetail("advisor.assessment-history.view", "op=view_assessment_history"),
      "เข้าถึงประวัติผลประเมินย้อนหลังของนักศึกษา"
    );
    assert.equal(
      resolveAuditTargetLabel("advisor.assessment-history.view", "User"),
      "บัญชีนักศึกษา"
    );
  });

  it("AD-04 แปลง metadata ดิบเป็นภาษาไทยเมื่อไม่มีป้ายตายตัว", () => {
    assert.equal(humanizeAuditMetadata("op=view_assessment_history"), "เปิดดูประวัติผลประเมิน");
    assert.equal(
      humanizeAuditMetadata("op=create studentId=663380696-6"),
      "สร้างรายการใหม่ (รหัสนักศึกษา 663380696-6)"
    );
    assert.equal(humanizeAuditMetadata("ok"), null);
  });

  it("AD-05 กิจกรรม login/logout ยังเป็นทางการเหมือนเดิม", () => {
    assert.equal(resolveAuditActionLabel("auth.login.success"), "เข้าสู่ระบบสำเร็จ");
    assert.equal(
      resolveAuditActionDetail("auth.logout"),
      "สิ้นสุดเซสชันของผู้ใช้งาน"
    );
    assert.equal(resolveAuditTargetLabel("auth.login.success", "AuthSession"), "เซสชันเข้าสู่ระบบ");
  });

  it("AD-06 เป้าหมายใช้รหัสนักศึกษาแทน CUID", () => {
    assert.equal(
      formatAuditTargetRef({
        entityId: "cmwbq4edj0002ayv4lt7czghc",
        entityType: "User",
        studentId: "663380696-6",
      }),
      "663380696-6"
    );
  });
});
