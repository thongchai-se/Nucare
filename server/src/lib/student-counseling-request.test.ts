import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus } from "@prisma/client";
import { planStudentCounselingRequest } from "./student-counseling-request";

describe("planStudentCounselingRequest", () => {
  it("SCR-01 สร้างคำขอเมื่อมีที่ปรึกษาและไม่มีคิวเปิด", () => {
    const plan = planStudentCounselingRequest({
      assignedAdvisorId: "adv-1",
      hasActiveCounselingReferral: false,
      note: "อยากคุยเรื่องความเครียด",
    });
    assert.equal(plan.action, "create");
    if (plan.action === "create") {
      assert.equal(plan.advisorId, "adv-1");
      assert.match(plan.reason, /อยากคุยเรื่องความเครียด/);
    }
  });

  it("SCR-02 ปฏิเสธเมื่อไม่มีที่ปรึกษา", () => {
    const plan = planStudentCounselingRequest({
      assignedAdvisorId: null,
      hasActiveCounselingReferral: false,
      note: null,
    });
    assert.equal(plan.action, "reject");
    if (plan.action === "reject") {
      assert.equal(plan.reason, "no_assigned_advisor");
    }
  });

  it("SCR-03 ปฏิเสธเมื่อมี counseling เปิดอยู่", () => {
    const plan = planStudentCounselingRequest({
      assignedAdvisorId: "adv-1",
      hasActiveCounselingReferral: true,
      activeStatus: ReferralStatus.ACCEPTED,
      note: null,
    });
    assert.equal(plan.action, "reject");
    if (plan.action === "reject") {
      assert.equal(plan.reason, "active_counseling_referral");
      assert.match(plan.message, /กำลังดูแล/);
    }
  });
});
