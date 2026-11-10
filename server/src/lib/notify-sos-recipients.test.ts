import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeSosRecipients } from "./notify-sos-recipients";

describe("mergeSosRecipients", () => {
  it("SOS-R01 รวม MH กับที่ปรึกษาและตัดซ้ำโดยคง MH", () => {
    const recipients = mergeSosRecipients({
      mentalHealthUsers: [
        { id: "mh-1", email: "mh@test.local" },
        { id: "shared", email: "both@test.local" },
      ],
      advisors: [
        { id: "adv-1", email: "adv@test.local", isActive: true },
        { id: "shared", email: "both@test.local", isActive: true },
        { id: "adv-inactive", email: "x@test.local", isActive: false },
      ],
    });

    assert.equal(recipients.length, 3);
    assert.deepEqual(
      recipients.map((item) => ({ id: item.id, kind: item.kind })).sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: "adv-1", kind: "ADVISOR" },
        { id: "mh-1", kind: "MENTAL_HEALTH" },
        { id: "shared", kind: "MENTAL_HEALTH" },
      ]
    );
  });
});
