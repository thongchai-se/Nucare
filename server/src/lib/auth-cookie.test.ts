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

  it("rejects AUTH_COOKIE_SECURE=false in production without allow-insecure flag", () => {
    assert.equal(
      resolveAuthCookieSecure({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "false" }),
      true
    );
  });

  it("allows AUTH_COOKIE_SECURE=false only with AUTH_COOKIE_ALLOW_INSECURE=true", () => {
    assert.equal(
      resolveAuthCookieSecure({
        NODE_ENV: "production",
        AUTH_COOKIE_SECURE: "false",
        AUTH_COOKIE_ALLOW_INSECURE: "true",
      }),
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
