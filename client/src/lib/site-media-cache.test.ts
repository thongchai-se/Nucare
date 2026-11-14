import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseSiteMediaCacheEnvelope,
  SITE_MEDIA_CACHE_MAX_AGE_MS,
} from "./site-media-cache";
import type { SiteMediaItemDto } from "./site-media-api";

const sampleItem: SiteMediaItemDto = {
  id: "m1",
  slot: "HOME_HERO",
  title: "แบนเนอร์",
  altText: "แบนเนอร์",
  imageUrl: "/api/uploads/site-media/a.jpg",
  href: null,
  ctaLabel: null,
  tag: null,
  summary: null,
  sortOrder: 0,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("parseSiteMediaCacheEnvelope", () => {
  it("SMC-01 อ่านซองแคชที่ยังไม่หมดอายุ", () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({ savedAt: now - 1_000, items: [sampleItem] });
    const items = parseSiteMediaCacheEnvelope(raw, now, SITE_MEDIA_CACHE_MAX_AGE_MS);
    assert.equal(items?.length, 1);
    assert.equal(items?.[0]?.id, "m1");
    assert.equal(items?.[0]?.imageUrl, "/api/uploads/site-media/a.jpg");
  });

  it("SMC-02 ปฏิเสธแคชหมดอายุและข้อมูลพัง", () => {
    const now = 1_700_000_000_000;
    const expired = JSON.stringify({
      savedAt: now - SITE_MEDIA_CACHE_MAX_AGE_MS - 1,
      items: [sampleItem],
    });
    assert.equal(parseSiteMediaCacheEnvelope(expired, now), null);
    assert.equal(parseSiteMediaCacheEnvelope(null, now), null);
    assert.equal(parseSiteMediaCacheEnvelope("{", now), null);
    assert.equal(parseSiteMediaCacheEnvelope(JSON.stringify({ savedAt: now }), now), null);
    assert.equal(
      parseSiteMediaCacheEnvelope(JSON.stringify({ savedAt: "x", items: [] }), now),
      null
    );
  });

  it("SMC-03 รับอาร์เรย์ว่างที่ยังไม่หมดอายุ (แอดมินลบครบ)", () => {
    const now = 1_700_000_000_000;
    const raw = JSON.stringify({ savedAt: now, items: [] });
    const items = parseSiteMediaCacheEnvelope(raw, now);
    assert.deepEqual(items, []);
  });
});
