import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUnsafeMethodOriginAllowed } from "./request-origin";

const allowed = new Set(["https://nucare.example"]);

describe("isUnsafeMethodOriginAllowed", () => {
  it("RO-01 GET ผ่านเสมอ", () => {
    assert.equal(
      isUnsafeMethodOriginAllowed({
        method: "GET",
        origin: "https://evil.example",
        secFetchSite: "cross-site",
        allowedOrigins: allowed,
        isProduction: true,
      }),
      true
    );
  });

  it("RO-02 production ปฏิเสธ Origin นอก allowlist", () => {
    assert.equal(
      isUnsafeMethodOriginAllowed({
        method: "POST",
        origin: "https://evil.example",
        secFetchSite: "cross-site",
        allowedOrigins: allowed,
        isProduction: true,
      }),
      false
    );
  });

  it("RO-03 production ปฏิเสธเมื่อไม่มี Origin และไม่ใช่ same-site", () => {
    assert.equal(
      isUnsafeMethodOriginAllowed({
        method: "POST",
        origin: undefined,
        secFetchSite: "cross-site",
        allowedOrigins: allowed,
        isProduction: true,
      }),
      false
    );
  });

  it("RO-04 production อนุญาต same-origin โดยไม่มี Origin", () => {
    assert.equal(
      isUnsafeMethodOriginAllowed({
        method: "PATCH",
        origin: undefined,
        secFetchSite: "same-origin",
        allowedOrigins: allowed,
        isProduction: true,
      }),
      true
    );
  });

  it("RO-05 development อนุญาตเมื่อไม่มี Origin", () => {
    assert.equal(
      isUnsafeMethodOriginAllowed({
        method: "POST",
        origin: undefined,
        secFetchSite: undefined,
        allowedOrigins: allowed,
        isProduction: false,
      }),
      true
    );
  });
});
