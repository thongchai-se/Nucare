import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ConsultationRequestStatus,
  EmergencyCaseStatus,
  ReferralStatus,
  RiskLevel,
} from "@prisma/client";
import {
  aggregateCommonIssues,
  buildOperationsStats,
  buildSectionStats,
  buildStudyYearBucket,
  buildStudyYearBuckets,
  buildTrendItems,
  createEmptyDistressCounts,
  getStudyYearLabel,
  mapConsultationTopicToIssueLabel,
  mergeStudentScreeningProfile,
} from "./executive-analytics";

describe("executive analytics", () => {
  it("EA-01 getStudyYearLabel formats year and unknown", () => {
    assert.equal(getStudyYearLabel(1), "ชั้นปีที่ 1");
    assert.equal(getStudyYearLabel(4), "ชั้นปีที่ 4");
    assert.equal(getStudyYearLabel(9), "ชั้นปีที่ 4");
    assert.equal(getStudyYearLabel(null), "ไม่ระบุ");
  });

  it("EA-02 mapConsultationTopicToIssueLabel groups topics", () => {
    assert.equal(mapConsultationTopicToIssueLabel("การเรียนและผลการเรียน"), "ปัญหาการเรียน / ฝึกปฏิบัติ");
    assert.equal(mapConsultationTopicToIssueLabel("ทุนการศึกษาและค่าใช้จ่าย"), "ปัญหาการเงิน");
    assert.equal(mapConsultationTopicToIssueLabel("unknown topic"), "อื่นๆ");
  });

  it("EA-03 mergeStudentScreeningProfile prefers survey over assessment", () => {
    const profile = mergeStudentScreeningProfile({
      id: "s1",
      studyYear: 2,
      section: "A",
      surveyResult: {
        totalScore: 20,
        riskLevel: RiskLevel.MEDIUM,
        submittedAt: new Date("2026-03-01"),
        isGhq28: true,
      },
      latestAssessment: {
        riskLevel: RiskLevel.HIGH,
        assessedAt: new Date("2026-02-01"),
      },
    });

    assert.equal(profile.isScreened, true);
    assert.equal(profile.distressLevel, "MILD");
    assert.equal(profile.riskLevel, RiskLevel.MEDIUM);
    assert.equal(profile.ghq28Score, 20);
  });

  it("EA-04 mergeStudentScreeningProfile falls back to assessment", () => {
    const profile = mergeStudentScreeningProfile({
      id: "s2",
      studyYear: 3,
      section: null,
      latestAssessment: {
        riskLevel: RiskLevel.HIGH,
        assessedAt: new Date("2026-04-01"),
      },
    });

    assert.equal(profile.isScreened, true);
    assert.equal(profile.riskLevel, RiskLevel.HIGH);
    assert.equal(profile.distressLevel, null);
  });

  it("EA-05 buildStudyYearBucket aggregates distress and risk counts", () => {
    const profiles = [
      mergeStudentScreeningProfile({
        id: "y1-normal",
        studyYear: 1,
        section: "A",
        surveyResult: {
          totalScore: 10,
          riskLevel: RiskLevel.NORMAL,
          submittedAt: new Date("2026-06-01"),
          isGhq28: true,
        },
      }),
      mergeStudentScreeningProfile({
        id: "y1-severe",
        studyYear: 1,
        section: "A",
        surveyResult: {
          totalScore: 50,
          riskLevel: RiskLevel.HIGH,
          submittedAt: new Date("2026-06-02"),
          isGhq28: true,
        },
      }),
      mergeStudentScreeningProfile({
        id: "y2-none",
        studyYear: 2,
        section: "B",
      }),
    ];

    const bucket = buildStudyYearBucket({
      studyYear: 1,
      filterStudyYear: 1,
      profiles,
      consultations: [],
      referrals: [],
      emergencies: [],
      screeningEvents: [],
    });

    assert.equal(bucket.totalStudents, 2);
    assert.equal(bucket.screenedCount, 2);
    assert.equal(bucket.distressCounts.NORMAL, 1);
    assert.equal(bucket.distressCounts.SEVERE, 1);
    assert.equal(bucket.riskCounts.HIGH, 1);
    assert.equal(bucket.highRiskPercent, 50);
    assert.equal(bucket.operations.openReferrals, 0);
    assert.equal(bucket.operations.openSos, 0);
  });

  it("EA-05b buildOperationsStats and year-scoped bucket ops", () => {
    const ops = buildOperationsStats({
      consultations: [
        {
          status: ConsultationRequestStatus.CLOSED,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          acceptedAt: new Date("2026-01-01T02:00:00.000Z"),
        },
        {
          status: ConsultationRequestStatus.PENDING,
          createdAt: new Date("2026-01-02T00:00:00.000Z"),
          acceptedAt: null,
        },
      ],
      referrals: [{ status: ReferralStatus.PENDING }, { status: ReferralStatus.CLOSED }],
      emergencies: [{ status: EmergencyCaseStatus.OPEN }, { status: EmergencyCaseStatus.RESOLVED }],
    });

    assert.equal(ops.openReferrals, 1);
    assert.equal(ops.openSos, 1);
    assert.equal(ops.caseClosureRate, 50);
    assert.equal(ops.avgConsultationResponseHours, 2);

    const bucket = buildStudyYearBucket({
      studyYear: 1,
      filterStudyYear: 1,
      profiles: [mergeStudentScreeningProfile({ id: "s1", studyYear: 1, section: "A" })],
      consultations: [
        {
          topic: "สุขภาพใจและความเครียด",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          acceptedAt: new Date("2026-01-01T01:00:00.000Z"),
          status: ConsultationRequestStatus.CLOSED,
          studentStudyYear: 1,
        },
        {
          topic: "สุขภาพใจและความเครียด",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          acceptedAt: null,
          status: ConsultationRequestStatus.PENDING,
          studentStudyYear: 2,
        },
      ],
      referrals: [
        { createdAt: new Date(), status: ReferralStatus.PENDING, studentStudyYear: 1 },
        { createdAt: new Date(), status: ReferralStatus.PENDING, studentStudyYear: 2 },
      ],
      emergencies: [
        { openedAt: new Date(), status: EmergencyCaseStatus.OPEN, studentStudyYear: 1 },
        { openedAt: new Date(), status: EmergencyCaseStatus.OPEN, studentStudyYear: 2 },
      ],
      screeningEvents: [],
    });

    assert.equal(bucket.operations.openReferrals, 1);
    assert.equal(bucket.operations.openSos, 1);
    // ปี 1: ปิด 1 จาก 3 เคส → 33%
    assert.equal(bucket.operations.caseClosureRate, 33);
  });

  it("EA-06 buildStudyYearBuckets returns overall and per-year rows", () => {
    const profiles = [
      mergeStudentScreeningProfile({ id: "a", studyYear: 1, section: "A" }),
      mergeStudentScreeningProfile({ id: "b", studyYear: 2, section: "B" }),
    ];

    const result = buildStudyYearBuckets({
      profiles,
      consultations: [],
      referrals: [],
      emergencies: [],
      screeningEvents: [],
    });

    assert.equal(result.overall.totalStudents, 2);
    assert.equal(result.overall.label, "ภาพรวมทั้งคณะ");
    assert.equal(result.byStudyYear.length, 2);
    assert.equal(result.byStudyYear[0]?.studyYear, 1);
    assert.equal(result.byStudyYear[1]?.studyYear, 2);
  });

  it("EA-07 aggregateCommonIssues computes percentages", () => {
    const issues = aggregateCommonIssues([
      "การเรียนและผลการเรียน",
      "การเรียนและผลการเรียน",
      "ทุนการศึกษาและค่าใช้จ่าย",
    ]);

    const studyIssue = issues.find((item) => item.label === "ปัญหาการเรียน / ฝึกปฏิบัติ");
    assert.ok(studyIssue);
    assert.equal(studyIssue.count, 2);
    assert.equal(studyIssue.percent, 67);
  });

  it("EA-08 buildTrendItems filters by study year", () => {
    const trends = buildTrendItems({
      screeningEvents: [
        {
          at: new Date("2026-06-15"),
          studentId: "s1",
          studentStudyYear: 1,
          riskLevel: RiskLevel.HIGH,
        },
        {
          at: new Date("2026-06-16"),
          studentId: "s2",
          studentStudyYear: 2,
          riskLevel: RiskLevel.NORMAL,
        },
      ],
      referrals: [],
      emergencies: [],
      filterStudyYear: 1,
      now: new Date("2026-06-20"),
    });

    const juneTrend = trends.find((item) => item.month === "2026-06");
    assert.ok(juneTrend);
    assert.equal(juneTrend.screened, 1);
    assert.equal(juneTrend.highRisk, 1);
  });

  it("EA-09 buildSectionStats groups by section", () => {
    const profiles = [
      mergeStudentScreeningProfile({
        id: "s1",
        studyYear: 1,
        section: "A",
        surveyResult: {
          totalScore: 50,
          riskLevel: RiskLevel.HIGH,
          submittedAt: new Date("2026-06-01"),
          isGhq28: true,
        },
      }),
      mergeStudentScreeningProfile({ id: "s2", studyYear: 1, section: "A" }),
    ];

    const sections = buildSectionStats(profiles, "ALL");
    assert.equal(sections.length, 1);
    assert.equal(sections[0]?.section, "A");
    assert.equal(sections[0]?.totalStudents, 2);
    assert.equal(sections[0]?.highRiskPercent, 50);
  });

  it("EA-10 createEmptyDistressCounts starts at zero", () => {
    const counts = createEmptyDistressCounts();
    assert.equal(counts.NORMAL, 0);
    assert.equal(counts.unscreened, 0);
  });
});
