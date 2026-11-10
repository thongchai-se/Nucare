import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatQueueWait } from "./format-queue-wait";

describe("formatQueueWait", () => {
  const now = Date.parse("2026-11-07T15:00:00.000Z");

  it("returns fresh label for invalid or very recent times", () => {
    assert.equal(formatQueueWait("not-a-date", now), "เพิ่งเข้าคิว");
    assert.equal(formatQueueWait("2026-11-07T14:59:00.000Z", now), "เพิ่งเข้าคิว");
  });

  it("formats minutes and hours", () => {
    assert.equal(formatQueueWait("2026-11-07T14:30:00.000Z", now), "รอมา 30 นาที");
    assert.equal(formatQueueWait("2026-11-07T12:00:00.000Z", now), "รอมา 3 ชม.");
  });

  it("formats multi-day waits", () => {
    assert.equal(formatQueueWait("2026-11-04T15:00:00.000Z", now), "รอมา 3 วัน");
  });
});
