import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sanitizeTrafficPath,
  sanitizeUserAgent,
  shouldSkipTrafficLogPath,
} from "./traffic-log";

describe("traffic-log sanitizers", () => {
  it("ตัด query string ออกจาก path", () => {
    assert.equal(
      sanitizeTrafficPath("/api/auth/login?token=secret&x=1"),
      "/api/auth/login"
    );
  });

  it("จำกัดความยาว user-agent", () => {
    const longAgent = `Mozilla/${"x".repeat(400)}`;
    const sanitized = sanitizeUserAgent(longAgent);
    assert.ok(sanitized);
    assert.ok(sanitized!.length <= 300);
    assert.ok(sanitized!.endsWith("…"));
  });

  it("คืน null เมื่อไม่มี user-agent", () => {
    assert.equal(sanitizeUserAgent(undefined), null);
    assert.equal(sanitizeUserAgent("   "), null);
  });
});

describe("shouldSkipTrafficLogPath", () => {
  it("TL-01 ข้าม health / session และเส้นทาง chat ที่โพลบ่อย", () => {
    assert.equal(shouldSkipTrafficLogPath("/api/health"), true);
    assert.equal(shouldSkipTrafficLogPath("/"), true);
    assert.equal(shouldSkipTrafficLogPath("/api/auth/session"), true);
    assert.equal(shouldSkipTrafficLogPath("/api/chat/unread-count"), true);
    assert.equal(shouldSkipTrafficLogPath("/api/chat/sessions/abc/messages"), true);
  });

  it("TL-02 ไม่ข้าม API ทั่วไป", () => {
    assert.equal(shouldSkipTrafficLogPath("/api/auth/login"), false);
    assert.equal(shouldSkipTrafficLogPath("/api/mental-health/dashboard"), false);
  });
});
