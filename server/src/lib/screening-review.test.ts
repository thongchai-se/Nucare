import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReferralStatus, ReferralTarget, RiskLevel, Role } from "@prisma/client";
import {
  allowedScreeningReferralTargets,
  compareScreeningReviews,
  deriveScreeningReviewStatus,
  findBlockingReferral,
  isScreeningReviewRisk,
  matchesScreeningReviewStatus,
  resolveScreeningReviewCutoff,
  resolveScreeningReviewRiskLevels,
  resolveScreeningReviewScope,
  selectCurrentScreeningReviews,
  studentSurveyKey,
  toScreeningReviewItem,
} from "./screening-review";

const at = (iso: string) => new Date(iso);

const candidate = (
  responseId: string,
  studentId: string,
  riskLevel: RiskLevel,
  submittedAt: string,
  surveyId = "s1"
) => ({ responseId, studentId, surveyId, riskLevel, submittedAt: at(submittedAt) });

describe("resolveScreeningReviewScope", () => {
  it("advisor sees advisees only", () => {
    assert.equal(resolveScreeningReviewScope([Role.ADVISOR]), "advisees");
  });

  it("student development and admin see all", () => {
    assert.equal(resolveScreeningReviewScope([Role.STUDENT_DEVELOPMENT]), "all");
    assert.equal(resolveScreeningReviewScope([Role.ADMIN]), "all");
  });

  it("mental health only gets no automatic queue", () => {
    assert.equal(resolveScreeningReviewScope([Role.MENTAL_HEALTH]), "none");
    assert.equal(resolveScreeningReviewScope([Role.EXECUTIVE]), "none");
    assert.equal(resolveScreeningReviewScope([Role.STUDENT]), "none");
    assert.equal(resolveScreeningReviewScope(undefined), "none");
    assert.equal(resolveScreeningReviewScope([]), "none");
  });

  it("explicit viewer pins the scope even for multi-role users", () => {
    const roles = [Role.ADVISOR, Role.STUDENT_DEVELOPMENT];
    assert.equal(resolveScreeningReviewScope(roles, "advisor"), "advisees");
    assert.equal(resolveScreeningReviewScope(roles, "staff"), "all");
    assert.equal(resolveScreeningReviewScope([Role.ADVISOR], "staff"), "none");
    assert.equal(resolveScreeningReviewScope([Role.STUDENT_DEVELOPMENT], "advisor"), "none");
  });

  it("legacy instructor role collapses to advisor", () => {
    assert.equal(resolveScreeningReviewScope([Role.INSTRUCTOR]), "advisees");
  });
});

describe("risk filters", () => {
  it("only MEDIUM and HIGH are reviewable", () => {
    assert.equal(isScreeningReviewRisk(RiskLevel.HIGH), true);
    assert.equal(isScreeningReviewRisk(RiskLevel.MEDIUM), true);
    assert.equal(isScreeningReviewRisk(RiskLevel.NORMAL), false);
  });

  it("defaults to both levels and strips NORMAL", () => {
    assert.deepEqual(resolveScreeningReviewRiskLevels(), [RiskLevel.HIGH, RiskLevel.MEDIUM]);
    assert.deepEqual(resolveScreeningReviewRiskLevels([]), [RiskLevel.HIGH, RiskLevel.MEDIUM]);
    assert.deepEqual(
      resolveScreeningReviewRiskLevels([RiskLevel.NORMAL, RiskLevel.HIGH, RiskLevel.HIGH]),
      [RiskLevel.HIGH]
    );
    assert.deepEqual(resolveScreeningReviewRiskLevels([RiskLevel.NORMAL]), []);
  });

  it("cutoff is 90 days back by default", () => {
    const cutoff = resolveScreeningReviewCutoff(at("2026-11-11T00:00:00.000Z"));
    assert.equal(cutoff.toISOString(), "2026-08-13T00:00:00.000Z");
  });
});

describe("selectCurrentScreeningReviews", () => {
  it("drops a risky response superseded by a newer response of the same survey", () => {
    const rows = [candidate("r-old", "u1", RiskLevel.HIGH, "2026-10-01T00:00:00Z")];
    const latest = new Map([[studentSurveyKey("u1", "s1"), at("2026-11-01T00:00:00Z").getTime()]]);
    assert.deepEqual(selectCurrentScreeningReviews(rows, latest), []);
  });

  it("keeps a response that is still the latest of its survey", () => {
    const rows = [candidate("r1", "u1", RiskLevel.MEDIUM, "2026-11-01T00:00:00Z")];
    const latest = new Map([[studentSurveyKey("u1", "s1"), at("2026-11-01T00:00:00Z").getTime()]]);
    assert.equal(selectCurrentScreeningReviews(rows, latest).length, 1);
  });

  it("a newer response of a different survey does not hide it", () => {
    const rows = [candidate("r1", "u1", RiskLevel.HIGH, "2026-10-01T00:00:00Z", "ghq")];
    const latest = new Map([
      [studentSurveyKey("u1", "ghq"), at("2026-10-01T00:00:00Z").getTime()],
      [studentSurveyKey("u1", "other"), at("2026-11-05T00:00:00Z").getTime()],
    ]);
    assert.equal(selectCurrentScreeningReviews(rows, latest).length, 1);
  });

  it("collapses to one row per student preferring HIGH then newest", () => {
    const rows = [
      candidate("m-new", "u1", RiskLevel.MEDIUM, "2026-11-05T00:00:00Z", "a"),
      candidate("h-old", "u1", RiskLevel.HIGH, "2026-10-20T00:00:00Z", "b"),
      candidate("m2", "u2", RiskLevel.MEDIUM, "2026-11-01T00:00:00Z", "a"),
      candidate("m2-newer", "u2", RiskLevel.MEDIUM, "2026-11-02T00:00:00Z", "b"),
    ];
    const latest = new Map<string, number>([
      [studentSurveyKey("u1", "a"), at("2026-11-05T00:00:00Z").getTime()],
      [studentSurveyKey("u1", "b"), at("2026-10-20T00:00:00Z").getTime()],
      [studentSurveyKey("u2", "a"), at("2026-11-01T00:00:00Z").getTime()],
      [studentSurveyKey("u2", "b"), at("2026-11-02T00:00:00Z").getTime()],
    ]);
    const picked = selectCurrentScreeningReviews(rows, latest);
    assert.equal(picked.length, 2);
    assert.equal(picked.find((row) => row.studentId === "u1")?.responseId, "h-old");
    assert.equal(picked.find((row) => row.studentId === "u2")?.responseId, "m2-newer");
  });
});

describe("deriveScreeningReviewStatus", () => {
  it("active referral wins over acknowledgement", () => {
    assert.equal(
      deriveScreeningReviewStatus({
        activeReferrals: [{ status: ReferralStatus.PENDING }],
        acknowledged: true,
      }),
      "REFERRED"
    );
    assert.equal(
      deriveScreeningReviewStatus({
        activeReferrals: [{ status: ReferralStatus.ACCEPTED }],
        acknowledged: false,
      }),
      "REFERRED"
    );
  });

  it("closed referral does not count as active", () => {
    assert.equal(
      deriveScreeningReviewStatus({
        activeReferrals: [{ status: ReferralStatus.CLOSED }],
        acknowledged: false,
      }),
      "PENDING"
    );
  });

  it("acknowledged vs pending", () => {
    assert.equal(deriveScreeningReviewStatus({ activeReferrals: [], acknowledged: true }), "ACKNOWLEDGED");
    assert.equal(deriveScreeningReviewStatus({ activeReferrals: [], acknowledged: false }), "PENDING");
  });
});

describe("matchesScreeningReviewStatus", () => {
  it("OPEN (default) hides referred rows", () => {
    assert.equal(matchesScreeningReviewStatus("PENDING"), true);
    assert.equal(matchesScreeningReviewStatus("ACKNOWLEDGED", "OPEN"), true);
    assert.equal(matchesScreeningReviewStatus("REFERRED", "OPEN"), false);
  });

  it("exact and ALL filters", () => {
    assert.equal(matchesScreeningReviewStatus("REFERRED", "REFERRED"), true);
    assert.equal(matchesScreeningReviewStatus("PENDING", "REFERRED"), false);
    assert.equal(matchesScreeningReviewStatus("REFERRED", "ALL"), true);
  });
});

describe("compareScreeningReviews", () => {
  it("sorts HIGH first then newest", () => {
    const rows = [
      { riskLevel: "medium" as const, submittedAt: at("2026-11-10T00:00:00Z") },
      { riskLevel: "high" as const, submittedAt: at("2026-11-01T00:00:00Z") },
      { riskLevel: "high" as const, submittedAt: at("2026-11-05T00:00:00Z") },
    ];
    rows.sort(compareScreeningReviews);
    assert.deepEqual(
      rows.map((row) => `${row.riskLevel}:${row.submittedAt.toISOString().slice(0, 10)}`),
      ["high:2026-11-05", "high:2026-11-01", "medium:2026-11-10"]
    );
  });
});

describe("referral targets and dedupe", () => {
  it("advisor can refer to both; student development only to counseling center", () => {
    assert.deepEqual(allowedScreeningReferralTargets("advisees", [Role.ADVISOR]), [
      ReferralTarget.STUDENT_DEVELOPMENT,
      ReferralTarget.COUNSELING_CENTER,
    ]);
    assert.deepEqual(allowedScreeningReferralTargets("all", [Role.STUDENT_DEVELOPMENT]), [
      ReferralTarget.COUNSELING_CENTER,
    ]);
    assert.deepEqual(allowedScreeningReferralTargets("none", [Role.MENTAL_HEALTH]), []);
  });

  it("blocks only an active referral in the same target", () => {
    const referrals = [
      { id: "a", target: ReferralTarget.STUDENT_DEVELOPMENT, status: ReferralStatus.PENDING },
      { id: "b", target: ReferralTarget.COUNSELING_CENTER, status: ReferralStatus.CLOSED },
    ];
    assert.equal(findBlockingReferral(referrals, ReferralTarget.STUDENT_DEVELOPMENT)?.id, "a");
    assert.equal(findBlockingReferral(referrals, ReferralTarget.COUNSELING_CENTER), null);
  });
});

describe("toScreeningReviewItem", () => {
  const response = {
    id: "resp1",
    riskLevel: RiskLevel.HIGH,
    submittedAt: at("2026-11-01T00:00:00Z"),
    survey: { title: "GHQ-28" },
    wave: { label: "ภาคเรียนที่ 1/2569" },
    student: {
      id: "u1",
      name: "นิสิต ทดสอบ",
      studentId: "6512345678",
      studyYear: 2,
      section: null,
      studentAssignments: [{ advisor: { name: "อาจารย์ ที่ปรึกษา" } }],
    },
  };

  it("maps privacy-safe fields only (no score or answers)", () => {
    const item = toScreeningReviewItem({ response, activeReferrals: [], acknowledgedAt: null });
    assert.equal(item.studentCode, "651234567-8");
    assert.equal(item.riskLevel, "high");
    assert.equal(item.section, "-");
    assert.equal(item.status, "PENDING");
    assert.equal(item.advisorName, "อาจารย์ ที่ปรึกษา");
    assert.ok(!("totalScore" in item));
    assert.ok(!("answers" in item));
  });

  it("marks REFERRED when an active referral exists", () => {
    const item = toScreeningReviewItem({
      response,
      activeReferrals: [{ id: "c1", target: ReferralTarget.COUNSELING_CENTER, status: ReferralStatus.PENDING }],
      acknowledgedAt: at("2026-11-02T00:00:00Z"),
    });
    assert.equal(item.status, "REFERRED");
    assert.equal(item.activeReferrals.length, 1);
  });
});
