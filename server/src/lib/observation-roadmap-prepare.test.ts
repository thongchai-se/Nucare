import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeRoadmapStepLabel,
  prepareRoadmapSteps,
} from "../../../client/src/components/advisor/observation-roadmap-prepare";

describe("normalizeRoadmapStepLabel", () => {
  it("splits long referral labels onto two lines", () => {
    const result = normalizeRoadmapStepLabel("ส่งต่อ · ทีมสุขภาพจิต / จิตแพทย์");
    assert.equal(result.label, "ส่งต่อ\nทีมสุขภาพจิต / จิตแพทย์");
    assert.equal(result.referralTarget, "ทีมสุขภาพจิต / จิตแพทย์");
  });
});

describe("prepareRoadmapSteps", () => {
  it("collapses duplicate referral pins and keeps latest actor/time", () => {
    const steps = prepareRoadmapSteps([
      {
        key: "reported",
        label: "แจ้งข้อสังเกต",
        at: "2026-10-29T00:56:00.000Z",
        kind: "reported",
      },
      {
        key: "ack",
        label: "รับเรื่อง",
        at: "2026-10-29T00:56:00.000Z",
        actorName: "นางสาว อรอุมา พัฒนาและที่ปรึกษา",
        kind: "acknowledged",
      },
      {
        key: "r1",
        label: "ส่งต่อ · ทีมสุขภาพจิต / จิตแพทย์",
        at: "2026-11-02T04:45:00.000Z",
        actorName: "อ.ดร. สุภาวดี ที่ปรึกษา",
        kind: "referred",
        detail: "สถานะ: ACCEPTED",
      },
      {
        key: "r2",
        label: "ส่งต่อ · ทีมสุขภาพจิต / จิตแพทย์",
        at: "2026-11-02T07:20:00.000Z",
        actorName: "อ.ดร. สุภาวดี ที่ปรึกษา",
        kind: "referred",
        detail: "สถานะ: PENDING",
      },
    ]);

    assert.equal(steps.length, 3);
    assert.equal(steps[2]?.label, "ส่งต่อ\nทีมสุขภาพจิต / จิตแพทย์");
    assert.equal(steps[2]?.at, "2026-11-02T07:20:00.000Z");
    assert.match(steps[2]?.detail || "", /2 ครั้ง/);
    assert.match(steps[2]?.detail || "", /PENDING/);
  });
});
