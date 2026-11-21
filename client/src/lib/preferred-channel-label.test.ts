import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePreferredChannelOptions,
  resolvePreferredChannelLabel,
} from "./student-dashboard";

describe("preferred-channel-label", () => {
  it("PCL-01 แปลงป้ายเก่าเป็นออนไซต์", () => {
    assert.equal(resolvePreferredChannelLabel("IN_PERSON", "พบตัว / ที่คณะ"), "ออนไซต์");
    assert.equal(resolvePreferredChannelLabel("IN_PERSON", "พบที่คณะ"), "ออนไซต์");
    assert.equal(resolvePreferredChannelLabel("ONLINE", "ออนไลน์"), "ออนไลน์");
  });

  it("PCL-02 ตัวเลือกจาก API ใช้ป้ายมาตรฐานและตัด MESSAGE ออก", () => {
    const options = normalizePreferredChannelOptions({
      ONLINE: "ออนไลน์",
      IN_PERSON: "พบตัว / ที่คณะ",
      MESSAGE: "ข้อความในระบบ",
      PHONE: "โทรศัพท์",
    });
    assert.deepEqual(options, {
      ONLINE: "ออนไลน์",
      IN_PERSON: "ออนไซต์",
    });
    assert.equal(resolvePreferredChannelLabel("MESSAGE"), "ข้อความในระบบ");
  });
});
