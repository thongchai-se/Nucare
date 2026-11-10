import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canMutateAcceptedReferral,
  mentalHealthOwnershipDeniedMessage,
  redactConfidentialCareNotes,
} from "./mental-health-ownership";

describe("mental-health ownership", () => {
  it("MHO-01 เจ้าของเคสแก้ได้ และเคสเก่าที่ยังไม่มี acceptedBy อนุญาต", () => {
    assert.equal(canMutateAcceptedReferral("mh-1", "mh-1"), true);
    assert.equal(canMutateAcceptedReferral(null, "mh-1"), true);
    assert.equal(canMutateAcceptedReferral(undefined, "mh-1"), true);
  });

  it("MHO-02 คนอื่นห้ามแก้เคสที่มีเจ้าของแล้ว", () => {
    assert.equal(canMutateAcceptedReferral("mh-1", "mh-2"), false);
    assert.match(mentalHealthOwnershipDeniedMessage(), /ผู้รับเคส/);
  });

  it("MHO-03 ตัดบันทึกลับออกจากประวัติคิวก่อนรับ", () => {
    const redacted = redactConfidentialCareNotes([
      {
        id: "c1",
        summary: "S/O/A",
        confidentialNotes: "ความลับ",
      },
    ]);
    assert.equal(redacted[0]?.confidentialNotes, null);
    assert.equal(redacted[0]?.summary, "S/O/A");
  });
});
