import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDonutArcs, describeDonutArc } from "./donut-chart";

describe("donut chart", () => {
  it("DC-01 สัดส่วนรวม 100% และมี path", () => {
    const { total, arcs } = buildDonutArcs([
      { id: "a", label: "ปกติ", value: 20, color: "#059669" },
      { id: "b", label: "ปานกลาง", value: 16, color: "#d97706" },
      { id: "c", label: "สูง", value: 16, color: "#dc2626" },
    ]);
    assert.equal(total, 52);
    assert.equal(arcs.length, 3);
    const percentSum = arcs.reduce((sum, arc) => sum + arc.percent, 0);
    assert.ok(Math.abs(percentSum - 100) < 1e-6);
    for (const arc of arcs) {
      assert.ok(arc.path.includes("A "));
      assert.ok(arc.path.endsWith("Z"));
    }
  });

  it("DC-02 ค่าว่างหรือศูนย์ไม่สร้าง arc", () => {
    assert.deepEqual(buildDonutArcs([{ id: "z", label: "ว่าง", value: 0, color: "#000" }]), {
      total: 0,
      arcs: [],
    });
    assert.equal(describeDonutArc(0, 0, 10, 5, 0, 0), "");
  });

  it("DC-03 ใส่ gap แล้วยังมี path ครบทุกชิ้น", () => {
    const { arcs } = buildDonutArcs(
      [
        { id: "a", label: "ปกติ", value: 10, color: "#059669" },
        { id: "b", label: "สูง", value: 10, color: "#dc2626" },
      ],
      { gapRadians: 0.08 }
    );
    assert.equal(arcs.length, 2);
    assert.ok(arcs.every((arc) => arc.path.length > 0));
  });
});
