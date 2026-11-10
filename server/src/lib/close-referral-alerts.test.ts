import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlertStatus, AlertType } from "@prisma/client";
import { buildCloseReferralAlertWhere } from "./close-referral-alerts";

describe("closeReferralReceivedAlerts where", () => {
  it("CRA-01 ปิดเฉพาะ REFERRAL_RECEIVED ของ referral นั้นที่ยังเปิด", () => {
    assert.deepEqual(buildCloseReferralAlertWhere("ref-1"), {
      sourceType: "CaseReferral",
      sourceId: "ref-1",
      type: AlertType.REFERRAL_RECEIVED,
      status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
    });
  });
});
