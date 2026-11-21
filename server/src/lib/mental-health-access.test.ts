import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus } from "@prisma/client";
import {
  redactClinicalCareSessionFields,
  resolveMentalHealthAccessFromReferrals,
  scopeMentalHealthDashboardCareSessions,
} from "./mental-health-access";

describe("resolveMentalHealthAccessFromReferrals", () => {
  it("MHA-01 เจ้าของเคส ACCEPTED ได้ clinical", () => {
    assert.equal(
      resolveMentalHealthAccessFromReferrals("mh-1", [
        {
          id: "r1",
          status: ReferralStatus.ACCEPTED,
          acceptedByUserId: "mh-1",
          declines: [],
        },
      ]),
      "clinical"
    );
  });

  it("MHA-02 คิว PENDING ที่ยังไม่ปฏิเสธได้ triage", () => {
    assert.equal(
      resolveMentalHealthAccessFromReferrals("mh-2", [
        {
          id: "r2",
          status: ReferralStatus.PENDING,
          acceptedByUserId: null,
          declines: [],
        },
      ]),
      "triage"
    );
  });

  it("MHA-03 เคส ACCEPTED ของคนอื่นโดยไม่มี PENDING ของตน = none", () => {
    assert.equal(
      resolveMentalHealthAccessFromReferrals("mh-2", [
        {
          id: "r3",
          status: ReferralStatus.ACCEPTED,
          acceptedByUserId: "mh-1",
          declines: [],
        },
      ]),
      "none"
    );
  });

  it("MHA-04 PENDING ที่ตนปฏิเสธแล้ว = none", () => {
    assert.equal(
      resolveMentalHealthAccessFromReferrals("mh-2", [
        {
          id: "r4",
          status: ReferralStatus.PENDING,
          acceptedByUserId: null,
          declines: [{ userId: "mh-2" }],
        },
      ]),
      "none"
    );
  });

  it("MHA-05 มีทั้งเคสคนอื่นและ PENDING ของตน = triage (ไม่ clinical)", () => {
    assert.equal(
      resolveMentalHealthAccessFromReferrals("mh-2", [
        {
          id: "r5",
          status: ReferralStatus.ACCEPTED,
          acceptedByUserId: "mh-1",
          declines: [],
        },
        {
          id: "r6",
          status: ReferralStatus.PENDING,
          acceptedByUserId: null,
          declines: [],
        },
      ]),
      "triage"
    );
  });
});

describe("scopeMentalHealthDashboardCareSessions", () => {
  const sessions = [
    {
      id: "c1",
      sessionDate: "2026-01-01",
      summary: "clinical summary",
      interventionPlan: "plan",
      providerName: "อ.มาลี",
      createdAt: "2026-01-01",
    },
  ];

  it("MHA-06 เจ้าของเคสเห็น recentCareSessions", () => {
    const scoped = scopeMentalHealthDashboardCareSessions({
      referralStatus: ReferralStatus.ACCEPTED,
      acceptedByUserId: "mh-1",
      actorUserId: "mh-1",
      sessions,
    });
    assert.equal(scoped.length, 1);
    assert.equal(scoped[0]?.summary, "clinical summary");
  });

  it("MHA-07 คนอื่นและคิว PENDING ไม่เห็นเนื้อหาคลินิก", () => {
    assert.deepEqual(
      scopeMentalHealthDashboardCareSessions({
        referralStatus: ReferralStatus.ACCEPTED,
        acceptedByUserId: "mh-1",
        actorUserId: "mh-2",
        sessions,
      }),
      []
    );
    assert.deepEqual(
      scopeMentalHealthDashboardCareSessions({
        referralStatus: ReferralStatus.PENDING,
        acceptedByUserId: null,
        actorUserId: "mh-2",
        sessions,
      }),
      []
    );
  });
});

describe("redactClinicalCareSessionFields", () => {
  it("MHA-08 ตัด summary/plan/บันทึกลับตอน triage", () => {
    const redacted = redactClinicalCareSessionFields([
      {
        id: "c1",
        summary: "S",
        interventionPlan: "P",
        confidentialNotes: "secret",
      },
    ]);
    assert.equal(redacted[0]?.summary, "");
    assert.equal(redacted[0]?.interventionPlan, "");
    assert.equal(redacted[0]?.confidentialNotes, null);
  });
});
