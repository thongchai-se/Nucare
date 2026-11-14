import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveMediaHref } from "./media-href";

describe("resolveMediaHref", () => {
  it("MH-01 รับ path ในแอปพร้อม query", () => {
    assert.deepEqual(resolveMediaHref("/student/advisor"), {
      href: "/student/advisor",
      external: false,
    });
    assert.deepEqual(resolveMediaHref("/student/chat?persona=peer-male"), {
      href: "/student/chat?persona=peer-male",
      external: false,
    });
  });

  it("MH-02 รับ http(s) ภายนอก", () => {
    assert.deepEqual(resolveMediaHref("https://nurse.kku.ac.th/activity"), {
      href: "https://nurse.kku.ac.th/activity",
      external: true,
    });
    assert.equal(resolveMediaHref("http://example.com")?.external, true);
  });

  it("MH-03 ปฏิเสธโปรโตคอลอันตรายและค่าว่าง", () => {
    assert.equal(resolveMediaHref("javascript:alert(1)"), null);
    assert.equal(resolveMediaHref("data:text/html,hi"), null);
    assert.equal(resolveMediaHref("//evil.example"), null);
    assert.equal(resolveMediaHref(""), null);
    assert.equal(resolveMediaHref("   "), null);
    assert.equal(resolveMediaHref(null), null);
  });
});
