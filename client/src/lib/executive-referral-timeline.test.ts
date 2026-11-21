import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTimelineSteps } from "./executive-referral-timeline";

describe("buildTimelineSteps", () => {
  it("ERT-01 สร้างไทม์ไลน์ส่ง→รับ→ปิด โดยไม่รวมปฏิเสธคิว", () => {
    const steps = buildTimelineSteps(
      [
        {
          key: "sent",
          label: "ส่งต่อเคส",
          at: "2026-11-15T03:43:00.000Z",
          actorName: "ที่ปรึกษา 2",
          kind: "sent",
          detail: "ส่งถึง: ศูนย์\nเหตุผล: 111",
        },
        {
          key: "accepted",
          label: "รับเคสแล้ว",
          at: "2026-11-15T03:50:00.000Z",
          actorName: "MH 2",
          kind: "accepted",
          detail: "MH 2 รับช่วงดูแลเคสนี้แล้ว",
        },
        {
          key: "closed",
          label: "ปิดเคส",
          at: "2026-11-15T03:50:30.000Z",
          kind: "closed",
          detail: "เคสถูกปิดการติดตามแล้ว",
        },
      ],
      "ศูนย์ให้คำปรึกษา"
    );

    assert.deepEqual(
      steps.map((step) => step.kind),
      ["sent", "accepted", "closed"]
    );
    assert.equal(steps[0]?.detail, "ส่งถึง ศูนย์ให้คำปรึกษา");
    assert.equal(
      steps.some((step) => step.label.includes("ปฏิเสธ") || step.detail?.includes("ปฏิเสธ")),
      false
    );
  });
});
