import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAuthCookieSecure } from "./auth-cookie";

describe("resolveAuthCookieSecure", () => {
  it("defaults to true in production when AUTH_COOKIE_SECURE is unset", () => {
    assert.equal(resolveAuthCookieSecure({ NODE_ENV: "production" }), true);
  });

  it("defaults to false outside production when AUTH_COOKIE_SECURE is unset", () => {
    assert.equal(resolveAuthCookieSecure({ NODE_ENV: "development" }), false);
  });

  it("allows AUTH_COOKIE_SECURE=false for HTTP faculty staging", () => {
    assert.equal(
      resolveAuthCookieSecure({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "false" }),
      false
    );
  });

  it("allows AUTH_COOKIE_SECURE=true even outside production", () => {
    assert.equal(
      resolveAuthCookieSecure({ NODE_ENV: "development", AUTH_COOKIE_SECURE: "true" }),
      true
    );
  });
});
