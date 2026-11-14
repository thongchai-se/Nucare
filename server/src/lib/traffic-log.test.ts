import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeTrafficPath, sanitizeUserAgent } from "./traffic-log";

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
