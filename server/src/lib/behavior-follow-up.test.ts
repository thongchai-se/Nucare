import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlertStatus } from "@prisma/client";
import { getBehaviorRecordFollowUpStatus } from "./behavior-follow-up";

describe("getBehaviorRecordFollowUpStatus", () => {
  it("returns PENDING when there are no alerts", () => {
    assert.equal(getBehaviorRecordFollowUpStatus([]), "PENDING");
  });

  it("returns PENDING when all alerts are still OPEN", () => {
    assert.equal(
      getBehaviorRecordFollowUpStatus([AlertStatus.OPEN, AlertStatus.OPEN]),
      "PENDING"
    );
  });

  it("returns ACKNOWLEDGED when any alert was acknowledged and none closed", () => {
    assert.equal(
      getBehaviorRecordFollowUpStatus([AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED]),
      "ACKNOWLEDGED"
    );
  });

  it("returns ACKNOWLEDGED when some alerts are closed but others remain open", () => {
    assert.equal(
      getBehaviorRecordFollowUpStatus([
        AlertStatus.OPEN,
        AlertStatus.ACKNOWLEDGED,
        AlertStatus.CLOSED,
      ]),
      "ACKNOWLEDGED"
    );
  });

  it("returns COMPLETED only when every alert is closed", () => {
    assert.equal(
      getBehaviorRecordFollowUpStatus([AlertStatus.CLOSED, AlertStatus.CLOSED]),
      "COMPLETED"
    );
  });
});
