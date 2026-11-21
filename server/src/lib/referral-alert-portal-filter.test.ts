import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlertType, ReferralTarget } from "@prisma/client";
import { keepAlertForReferralPortal } from "./referral-alert-portal-filter";

describe("referral-alert-portal-filter", () => {
  const targets = new Map<string, ReferralTarget>([
    ["ref-sd", ReferralTarget.STUDENT_DEVELOPMENT],
    ["ref-mh", ReferralTarget.COUNSELING_CENTER],
  ]);

  it("RAPF-01 เคสสวัสดิการไม่โชว์บนพอร์ทัลทีมปรึกษา", () => {
    const keep = keepAlertForReferralPortal(
      {
        type: AlertType.REFERRAL_RECEIVED,
        sourceType: "CaseReferral",
        sourceId: "ref-sd",
      },
      targets,
      ReferralTarget.COUNSELING_CENTER
    );
    assert.equal(keep, false);
  });

  it("RAPF-02 เคสศูนย์ให้คำปรึกษาโชว์บนพอร์ทัลทีมปรึกษา", () => {
    const keep = keepAlertForReferralPortal(
      {
        type: AlertType.REFERRAL_RECEIVED,
        sourceType: "CaseReferral",
        sourceId: "ref-mh",
      },
      targets,
      ReferralTarget.COUNSELING_CENTER
    );
    assert.equal(keep, true);
  });

  it("RAPF-03 เคสสวัสดิการโชว์บนพอร์ทัลพัฒนานิสิตเท่านั้น", () => {
    assert.equal(
      keepAlertForReferralPortal(
        {
          type: AlertType.REFERRAL_RECEIVED,
          sourceType: "CaseReferral",
          sourceId: "ref-sd",
        },
        targets,
        ReferralTarget.STUDENT_DEVELOPMENT
      ),
      true
    );
    assert.equal(
      keepAlertForReferralPortal(
        {
          type: AlertType.REFERRAL_RECEIVED,
          sourceType: "CaseReferral",
          sourceId: "ref-mh",
        },
        targets,
        ReferralTarget.STUDENT_DEVELOPMENT
      ),
      false
    );
  });

  it("RAPF-04 แจ้งเตือนประเภทอื่นยังผ่าน และ REFERRAL ที่ไม่มีแหล่งถูกตัด", () => {
    assert.equal(
      keepAlertForReferralPortal(
        { type: AlertType.SOS_OPENED, sourceType: "EmergencyCase", sourceId: "sos1" },
        targets,
        ReferralTarget.COUNSELING_CENTER
      ),
      true
    );
    assert.equal(
      keepAlertForReferralPortal(
        { type: AlertType.REFERRAL_RECEIVED, sourceType: "CaseReferral", sourceId: null },
        targets,
        ReferralTarget.COUNSELING_CENTER
      ),
      false
    );
  });
});
