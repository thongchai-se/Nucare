import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus } from "@prisma/client";
import { isOwnedAcceptedCase } from "./mental-health-access";

describe("MH owned accepted cases", () => {
  it("MHO-01 เคส ACCEPTED ของตนเท่านั้น", () => {
    assert.equal(
      isOwnedAcceptedCase({
        status: ReferralStatus.ACCEPTED,
        acceptedByUserId: "mh1",
        actorUserId: "mh1",
      }),
      true
    );
    assert.equal(
      isOwnedAcceptedCase({
        status: ReferralStatus.ACCEPTED,
        acceptedByUserId: "mh2",
        actorUserId: "mh1",
      }),
      false
    );
    assert.equal(
      isOwnedAcceptedCase({
        status: ReferralStatus.PENDING,
        acceptedByUserId: null,
        actorUserId: "mh1",
      }),
      false
    );
  });
});
