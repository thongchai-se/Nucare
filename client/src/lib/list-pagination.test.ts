import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAdaptiveRowsPerPage, slicePageItems } from "./list-pagination";

describe("computeAdaptiveRowsPerPage", () => {
  it("คืนแถวในช่วง min–max สำหรับจอเดสก์ท็อป", () => {
    const rows = computeAdaptiveRowsPerPage(900, 1280);
    assert.ok(rows >= 8);
    assert.ok(rows <= 16);
  });

  it("คืนแถวในช่วงมือถือเมื่อความกว้างน้อยกว่า 768", () => {
    const rows = computeAdaptiveRowsPerPage(700, 390);
    assert.ok(rows >= 3);
    assert.ok(rows <= 8);
  });

  it("ไม่เกิน max แม้จอสูงมาก", () => {
    const rows = computeAdaptiveRowsPerPage(4000, 1440);
    assert.equal(rows, 16);
  });
});

describe("slicePageItems", () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  it("ตัดหน้าแรกตาม rowsPerPage", () => {
    const page = slicePageItems(items, 1, 5);
    assert.deepEqual(page.pageItems, [1, 2, 3, 4, 5]);
    assert.equal(page.total, 25);
    assert.equal(page.totalPages, 5);
    assert.equal(page.rangeStart, 1);
    assert.equal(page.rangeEnd, 5);
    assert.equal(page.canGoPrev, false);
    assert.equal(page.canGoNext, true);
  });

  it("ตัดหน้าสุดท้ายได้ถูกต้อง", () => {
    const page = slicePageItems(items, 5, 5);
    assert.deepEqual(page.pageItems, [21, 22, 23, 24, 25]);
    assert.equal(page.rangeStart, 21);
    assert.equal(page.rangeEnd, 25);
    assert.equal(page.canGoNext, false);
  });

  it("clamp หน้าเกินจำนวนหน้าทั้งหมด", () => {
    const page = slicePageItems(items, 99, 10);
    assert.equal(page.currentPage, 3);
    assert.deepEqual(page.pageItems, [21, 22, 23, 24, 25]);
  });

  it("รายการว่างคืนช่วง 0 และหน้าเดียว", () => {
    const page = slicePageItems([], 3, 8);
    assert.deepEqual(page.pageItems, []);
    assert.equal(page.totalPages, 1);
    assert.equal(page.currentPage, 1);
    assert.equal(page.rangeStart, 0);
    assert.equal(page.rangeEnd, 0);
    assert.equal(page.canGoPrev, false);
    assert.equal(page.canGoNext, false);
  });

  it("กัน rowsPerPage ที่ไม่ถูกต้องด้วยค่าอย่างน้อย 1", () => {
    const page = slicePageItems(items, 1, 0);
    assert.equal(page.rowsPerPage, 1);
    assert.equal(page.pageItems.length, 1);
  });
});
