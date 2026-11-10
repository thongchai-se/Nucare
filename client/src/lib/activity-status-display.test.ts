import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { presentActivityStatus } from "./activity-status-display";

describe("activity-status-display", () => {
  it("ไม่โชว์ enum อังกฤษดิบ", () => {
    assert.equal(presentActivityStatus("REFERRAL", "PENDING")?.label, "รอรับ");
    assert.equal(presentActivityStatus("EMERGENCY", "OPEN")?.label, "เปิด");
    assert.equal(presentActivityStatus("CONSULTATION", "CANCELLED")?.label, "ยกเลิก");
    assert.equal(presentActivityStatus("ASSESSMENT", "high")?.label, "เสี่ยงสูง");
    assert.equal(presentActivityStatus("ASSESSMENT", "เสี่ยงสูง")?.label, "เสี่ยงสูง");
    assert.equal(presentActivityStatus("CARE", "UNKNOWN_XYZ")?.label, "ไม่ทราบสถานะ");
  });
});
