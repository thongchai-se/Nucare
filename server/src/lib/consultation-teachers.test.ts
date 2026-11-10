import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeConsultationTeacherLists } from "./consultation-teachers";

describe("mergeConsultationTeacherLists", () => {
  it("keeps all assigned advisors even when over limit pressure", () => {
    const assigned = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];
    const others = Array.from({ length: 30 }, (_, index) => ({ id: `o${index}` }));
    const merged = mergeConsultationTeacherLists(assigned, others, 20);
    assert.equal(merged.length, 20);
    assert.deepEqual(
      merged.slice(0, 3).map((item) => item.id),
      ["a1", "a2", "a3"]
    );
  });

  it("never drops assigned advisors when assigned count exceeds limit", () => {
    const assigned = Array.from({ length: 25 }, (_, index) => ({ id: `a${index}` }));
    const merged = mergeConsultationTeacherLists(assigned, [{ id: "o1" }], 20);
    assert.equal(merged.length, 25);
    assert.ok(merged.every((item) => item.id.startsWith("a")));
  });

  it("dedupes overlapping ids from others", () => {
    const merged = mergeConsultationTeacherLists([{ id: "a1" }], [{ id: "a1" }, { id: "o1" }], 20);
    assert.deepEqual(
      merged.map((item) => item.id),
      ["a1", "o1"]
    );
  });
});
