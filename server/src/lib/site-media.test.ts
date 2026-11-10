import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SiteMediaSlot } from "@prisma/client";
import {
  isSiteMediaSlot,
  parseImageDataUrl,
  SITE_MEDIA_MAX_BYTES,
  toSiteMediaPublicUrl,
} from "./site-media";

describe("site-media helpers", () => {
  it("SM-01 รับเฉพาะ slot ที่รองรับ", () => {
    assert.equal(isSiteMediaSlot("HOME_HERO"), true);
    assert.equal(isSiteMediaSlot("HOME_GALLERY"), true);
    assert.equal(isSiteMediaSlot("STUDENT_ACTIVITY"), true);
    assert.equal(isSiteMediaSlot("OTHER"), false);
    assert.equal(isSiteMediaSlot(""), false);
  });

  it("SM-02 ถอด data URL PNG ได้และปฏิเสธชนิดอื่น", () => {
    const png1x1 =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const parsed = parseImageDataUrl(png1x1);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) {
      return;
    }
    assert.equal(parsed.mime, "image/png");
    assert.equal(parsed.extension, "png");
    assert.ok(parsed.buffer.length > 0);

    const bad = parseImageDataUrl("data:image/gif;base64,AAAA");
    assert.ok("error" in bad);

    const notData = parseImageDataUrl("/home-gallery/01.jpg");
    assert.ok("error" in notData);
  });

  it("SM-03 ปฏิเสธไฟล์ใหญ่เกินลิมิต", () => {
    const huge = Buffer.alloc(SITE_MEDIA_MAX_BYTES + 1, 1).toString("base64");
    const parsed = parseImageDataUrl(`data:image/jpeg;base64,${huge}`);
    assert.ok("error" in parsed);
  });

  it("SM-04 สร้าง URL สาธารณะจากชื่อไฟล์เท่านั้น", () => {
    assert.equal(
      toSiteMediaPublicUrl("abc123.png"),
      "/api/uploads/site-media/abc123.png"
    );
    assert.equal(
      toSiteMediaPublicUrl("../etc/passwd"),
      "/api/uploads/site-media/passwd"
    );
    assert.equal(SiteMediaSlot.HOME_HERO, "HOME_HERO");
  });
});
