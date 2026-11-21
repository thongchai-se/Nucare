import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSecurityRedFlagSeverity,
  isCriticalSecurityRedFlag,
  isSecurityRedFlagAction,
  isSensitiveAdminPath,
  sanitizeAuditPath,
  shouldWriteThrottledAudit,
} from "./security-red-flag";

describe("security red flag", () => {
  it("SRF-01 จัดหมวด CRITICAL / HIGH / MEDIUM", () => {
    assert.equal(getSecurityRedFlagSeverity("auth.refresh.reuse-detected"), "CRITICAL");
    assert.equal(getSecurityRedFlagSeverity("security.privilege-probe"), "CRITICAL");
    assert.equal(getSecurityRedFlagSeverity("security.rate-limit"), "HIGH");
    assert.equal(getSecurityRedFlagSeverity("security.authz-denied"), "HIGH");
    assert.equal(getSecurityRedFlagSeverity("auth.login.failed"), "MEDIUM");
    assert.equal(getSecurityRedFlagSeverity("auth.login.success"), null);
  });

  it("SRF-02 isSecurityRedFlag / isCritical", () => {
    assert.equal(isSecurityRedFlagAction("auth.login.failed"), true);
    assert.equal(isSecurityRedFlagAction("admin.student.create"), false);
    assert.equal(isCriticalSecurityRedFlag("security.privilege-probe"), true);
    assert.equal(isCriticalSecurityRedFlag("auth.login.failed"), false);
  });

  it("SRF-03 path อ่อนไหวและ sanitize", () => {
    assert.equal(isSensitiveAdminPath("/api/admin/users"), true);
    assert.equal(isSensitiveAdminPath("/api/executive/overview"), true);
    assert.equal(isSensitiveAdminPath("/api/student/dashboard"), false);
    assert.equal(sanitizeAuditPath("/api/admin/users?x=1#y"), "/api/admin/users");
  });

  it("SRF-04 throttle เขียน audit ภายในหน้าต่างเวลา", () => {
    const map = new Map<string, number>();
    assert.equal(shouldWriteThrottledAudit("k", 1000, 1000, map), true);
    assert.equal(shouldWriteThrottledAudit("k", 1000, 1500, map), false);
    assert.equal(shouldWriteThrottledAudit("k", 1000, 2100, map), true);
  });
});
