import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SiteMediaSlot } from "@prisma/client";
import {
  buildReorderSortAssignments,
  isLinkOnlySiteMediaPath,
  isSiteMediaSlot,
  parseImageDataUrl,
  parseYoutubeVideoId,
  resolveNextSortOrder,
  sanitizeMediaHref,
  sanitizeYoutubeWatchUrl,
  SITE_MEDIA_LINK_ONLY_PATH,
  SITE_MEDIA_MAX_BYTES,
  toSiteMediaPublicUrl,
} from "./site-media";

describe("site-media helpers", () => {
  it("SM-01 รับเฉพาะ slot ที่รองรับ รวม HOME_VIDEO", () => {
    assert.equal(isSiteMediaSlot("HOME_HERO"), true);
    assert.equal(isSiteMediaSlot("HOME_GALLERY"), true);
    assert.equal(isSiteMediaSlot("HOME_VIDEO"), true);
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

  it("SM-05 รับเฉพาะลิงก์ path ในแอปหรือ http(s)", () => {
    assert.equal(sanitizeMediaHref("/student/advisor"), "/student/advisor");
    assert.equal(
      sanitizeMediaHref("https://nurse.kku.ac.th/news"),
      "https://nurse.kku.ac.th/news"
    );
    assert.equal(sanitizeMediaHref("javascript:alert(1)"), null);
    assert.equal(sanitizeMediaHref("//evil.example"), null);
    assert.equal(sanitizeMediaHref(""), null);
    assert.equal(sanitizeMediaHref(null), null);
  });

  it("SM-06 แปลงลิงก์ YouTube เป็นรหัสวิดีโอและ URL มาตรฐาน", () => {
    assert.equal(parseYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseYoutubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(parseYoutubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ"), null);
    assert.equal(
      sanitizeYoutubeWatchUrl("https://youtu.be/dQw4w9WgXcQ?t=10"),
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
    assert.equal(sanitizeYoutubeWatchUrl("https://vimeo.com/123"), null);
    assert.equal(isLinkOnlySiteMediaPath(SITE_MEDIA_LINK_ONLY_PATH), true);
    assert.equal(isLinkOnlySiteMediaPath("abc.png"), false);
  });

  it("SM-07 ลำดับถัดไปและแผน reorder เบา", () => {
    assert.equal(resolveNextSortOrder(null), 0);
    assert.equal(resolveNextSortOrder(undefined), 0);
    assert.equal(resolveNextSortOrder(0), 1);
    assert.equal(resolveNextSortOrder(4), 5);
    assert.deepEqual(buildReorderSortAssignments(["a", "b", "c"]), [
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });
});
