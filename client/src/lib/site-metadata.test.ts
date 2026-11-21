import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSiteUrl } from "./site-metadata";

describe("resolveSiteUrl", () => {
  it("SM-01 ใช้ URL เดี่ยวตามที่ตั้ง", () => {
    assert.equal(resolveSiteUrl("http://10.101.111.160:89"), "http://10.101.111.160:89");
  });

  it("SM-02 เลือก origin แรกจากรายการคั่นด้วย comma", () => {
    assert.equal(
      resolveSiteUrl("http://10.101.111.160:89,http://127.0.0.1:89,http://localhost:89"),
      "http://10.101.111.160:89"
    );
  });

  it("SM-03 ข้ามค่าว่าง/invalid แล้วใช้ตัวถัดไป", () => {
    assert.equal(resolveSiteUrl("not-a-url, https://nucare.example"), "https://nucare.example");
  });

  it("SM-04 fallback เมื่อไม่มีค่าที่ใช้ได้", () => {
    assert.equal(resolveSiteUrl(""), "http://localhost:3000");
    assert.equal(resolveSiteUrl(null), "http://localhost:3000");
    assert.equal(resolveSiteUrl("ftp://files.example"), "http://localhost:3000");
  });
});
