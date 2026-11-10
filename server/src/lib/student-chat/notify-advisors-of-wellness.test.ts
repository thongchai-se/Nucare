import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  notifyAdvisorsOfWellnessSignals,
  shouldNotifyCrisisWellness,
} from "./notify-advisors-of-wellness";

describe("notifyAdvisorsOfWellnessSignals", () => {
  it("WTN-01 ไม่แจ้งเมื่อไม่มีรหัส", async () => {
    const count = await notifyAdvisorsOfWellnessSignals({} as never, "s1", []);
    assert.equal(count, 0);
  });

  it("WTN-02 แจ้งเฉพาะเมื่อมี SELF_HARM_CRISIS", () => {
    assert.equal(shouldNotifyCrisisWellness(["ACADEMIC_STRESS"]), false);
    assert.equal(shouldNotifyCrisisWellness(["ACADEMIC_STRESS", "SELF_HARM_CRISIS"]), true);
  });

  it("WTN-03 สร้าง alert ให้ที่ปรึกษาและทีม MH เมื่อวิกฤต", async () => {
    let created = 0;
    const fakePrisma = {
      alert: {
        findFirst: async () => null,
        createMany: async ({ data }: { data: unknown[] }) => {
          created = data.length;
          return { count: data.length };
        },
      },
      studentAdvisorAssignment: {
        findMany: async () => [{ advisorId: "adv-1" }],
      },
      user: {
        findMany: async () => [{ id: "mh-1" }, { id: "adv-1" }],
      },
    };

    const count = await notifyAdvisorsOfWellnessSignals(fakePrisma as never, "s1", [
      "SELF_HARM_CRISIS",
    ]);

    assert.equal(count, 2);
    assert.equal(created, 2);
  });

  it("WTN-04 ไม่แจ้งซ้ำถ้ามี alert วิกฤตเปิดอยู่ภายใน 24 ชม.", async () => {
    let createCalled = false;
    const fakePrisma = {
      alert: {
        findFirst: async () => ({ id: "existing" }),
        createMany: async () => {
          createCalled = true;
          return { count: 1 };
        },
      },
      studentAdvisorAssignment: {
        findMany: async () => [{ advisorId: "adv-1" }],
      },
      user: {
        findMany: async () => [],
      },
    };

    const count = await notifyAdvisorsOfWellnessSignals(fakePrisma as never, "s1", [
      "SELF_HARM_CRISIS",
    ]);
    assert.equal(count, 0);
    assert.equal(createCalled, false);
  });
});
