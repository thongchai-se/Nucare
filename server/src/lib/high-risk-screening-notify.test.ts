import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planHighRiskScreeningNotify } from "./high-risk-screening-notify";

describe("planHighRiskScreeningNotify", () => {
  it("HRS-N01 แจ้งที่ปรึกษาเมื่อมีมอบหมาย", () => {
    const plan = planHighRiskScreeningNotify({
      assignedAdvisorIds: ["adv-1", "adv-1", "adv-2"],
      sourceLabel: "9Q",
    });
    assert.equal(plan.action, "notify_advisors");
    if (plan.action === "notify_advisors") {
      assert.deepEqual(plan.advisorIds, ["adv-1", "adv-2"]);
      assert.match(plan.message, /9Q/);
    }
  });

  it("HRS-N02 แจ้งเจ้าหน้าที่เมื่อยังไม่มีที่ปรึกษา", () => {
    const plan = planHighRiskScreeningNotify({
      assignedAdvisorIds: [],
      sourceLabel: "แบบประเมิน",
    });
    assert.equal(plan.action, "notify_staff_unassigned");
    if (plan.action === "notify_staff_unassigned") {
      assert.match(plan.title, /ไม่มีที่ปรึกษา/);
    }
  });
});
