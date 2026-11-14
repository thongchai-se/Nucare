import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAuditMetadata } from "./audit-metadata";

describe("formatAuditMetadata", () => {
  it("รวม key=value และข้ามค่าว่าง", () => {
    const text = formatAuditMetadata({
      op: "create",
      studentId: "663380696-6",
      note: "",
      missing: undefined,
    });
    assert.equal(text, "op=create studentId=663380696-6");
  });

  it("ไม่เก็บเนื้อหาขึ้นบรรทัดใหม่ในค่า metadata", () => {
    const text = formatAuditMetadata({
      reason: "บรรทัด1\nบรรทัด2|ตัด",
    });
    assert.equal(text, "reason=บรรทัด1 บรรทัด2 ตัด");
    assert.doesNotMatch(text, /\n/);
  });

  it("คืน ok เมื่อไม่มีฟิลด์", () => {
    assert.equal(formatAuditMetadata({}), "ok");
  });
});
