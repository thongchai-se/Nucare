import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createTemporaryPassword } from "./temporary-password";

describe("auth local password surface (SSO-ready)", () => {
  it("APS-01 ไม่มีเส้นทาง forgot/change/reset ใน auth.routes", () => {
    const source = readFileSync(new URL("../routes/auth.routes.ts", import.meta.url), "utf8");
    assert.equal(source.includes("forgot-password"), false);
    assert.equal(source.includes("change-password"), false);
    assert.equal(source.includes("reset-password"), false);
    assert.match(source, /\/login/);
  });

  it("APS-02 ยังสร้างรหัสชั่วคราวสำหรับบัญชีก่อน SSO ได้", () => {
    const password = createTemporaryPassword();
    assert.ok(password.length >= 16);
  });
});
