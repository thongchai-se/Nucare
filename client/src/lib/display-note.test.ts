import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeDisplayNote } from "./display-note";

describe("sanitizeDisplayNote", () => {
  it("DN-01 ตัดแท็ก TEMP_BULK_DEMO และคำนำส่งต่อ", () => {
    assert.equal(
      sanitizeDisplayNote(
        "[TEMP_BULK_DEMO] ส่งต่อสวัสดิการ — นิสิต #12 ต้องการช่วยเหลือเรื่องที่พัก/ทุน"
      ),
      "นิสิต #12 ต้องการช่วยเหลือเรื่องที่พัก/ทุน"
    );
  });

  it("DN-02 ค่าว่างหรือ null คืนสตริงว่าง", () => {
    assert.equal(sanitizeDisplayNote(null), "");
    assert.equal(sanitizeDisplayNote("  "), "");
  });
});
