import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RiskLevel,
  SurveyAudienceType,
  WellnessTrendSignalCode,
} from "@prisma/client";
import {
  buildEligibilityProfiles,
  countEligibleStudents,
  filterEligibleStudentIds,
  isStudentEligibleForAudience,
  matchesEligibilityRule,
  pickHigherRisk,
  type EligibilityStudentProfile,
} from "./survey-eligibility";

const baseProfile = (
  overrides: Partial<EligibilityStudentProfile> = {}
): EligibilityStudentProfile => ({
  id: "stu-1",
  studyYear: 1,
  section: "A",
  priorRiskLevel: RiskLevel.MEDIUM,
  wellnessSignalCodes: [WellnessTrendSignalCode.ACADEMIC_STRESS],
  ...overrides,
});

describe("pickHigherRisk", () => {
  it("returns the more severe level", () => {
    assert.equal(pickHigherRisk(RiskLevel.NORMAL, RiskLevel.HIGH), RiskLevel.HIGH);
    assert.equal(pickHigherRisk(RiskLevel.HIGH, RiskLevel.MEDIUM), RiskLevel.HIGH);
    assert.equal(pickHigherRisk(null, RiskLevel.MEDIUM), RiskLevel.MEDIUM);
    assert.equal(pickHigherRisk(null, null), null);
  });
});

describe("matchesEligibilityRule", () => {
  it("passes when all non-empty dimensions match (AND across, OR within)", () => {
    const ok = matchesEligibilityRule(baseProfile(), {
      priorRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH],
      wellnessSignalCodes: [WellnessTrendSignalCode.ACADEMIC_STRESS, WellnessTrendSignalCode.ANXIETY_THEME],
      studyYears: [1, 2],
      sections: ["A", "B"],
    });
    assert.equal(ok, true);
  });

  it("fails study year mismatch", () => {
    assert.equal(
      matchesEligibilityRule(baseProfile({ studyYear: 3 }), {
        priorRiskLevels: [],
        wellnessSignalCodes: [],
        studyYears: [1, 2],
        sections: [],
      }),
      false
    );
  });

  it("fails when prior risk is missing but rule requires risk", () => {
    assert.equal(
      matchesEligibilityRule(baseProfile({ priorRiskLevel: null }), {
        priorRiskLevels: [RiskLevel.HIGH],
        wellnessSignalCodes: [],
        studyYears: [],
        sections: [],
      }),
      false
    );
  });

  it("fails when no wellness signal overlaps", () => {
    assert.equal(
      matchesEligibilityRule(baseProfile({ wellnessSignalCodes: [WellnessTrendSignalCode.SLEEP_DISTURBANCE] }), {
        priorRiskLevels: [],
        wellnessSignalCodes: [WellnessTrendSignalCode.SELF_HARM_CRISIS],
        studyYears: [],
        sections: [],
      }),
      false
    );
  });

  it("empty rule dimensions do not filter", () => {
    assert.equal(
      matchesEligibilityRule(baseProfile({ priorRiskLevel: null, wellnessSignalCodes: [] }), {
        priorRiskLevels: [],
        wellnessSignalCodes: [],
        studyYears: [],
        sections: [],
      }),
      true
    );
  });
});

describe("isStudentEligibleForAudience", () => {
  it("ALL_STUDENTS always matches", () => {
    assert.equal(
      isStudentEligibleForAudience(baseProfile({ priorRiskLevel: null }), {
        audienceType: SurveyAudienceType.ALL_STUDENTS,
        rule: null,
      }),
      true
    );
  });

  it("RULE_BASED with empty rule denies by default", () => {
    assert.equal(
      isStudentEligibleForAudience(baseProfile(), {
        audienceType: SurveyAudienceType.RULE_BASED,
        rule: {
          priorRiskLevels: [],
          wellnessSignalCodes: [],
          studyYears: [],
          sections: [],
        },
      }),
      false
    );
  });

  it("RULE_BASED without rule denies", () => {
    assert.equal(
      isStudentEligibleForAudience(baseProfile(), {
        audienceType: SurveyAudienceType.RULE_BASED,
        rule: null,
      }),
      false
    );
  });

  it("RULE_BASED matches targeted risk cohort", () => {
    assert.equal(
      isStudentEligibleForAudience(baseProfile({ priorRiskLevel: RiskLevel.HIGH }), {
        audienceType: SurveyAudienceType.RULE_BASED,
        rule: {
          priorRiskLevels: [RiskLevel.MEDIUM, RiskLevel.HIGH],
          wellnessSignalCodes: [],
          studyYears: [],
          sections: [],
        },
      }),
      true
    );
  });
});

describe("buildEligibilityProfiles + count", () => {
  it("merges latest survey/assessment risk and wellness codes in linear passes", () => {
    const profiles = buildEligibilityProfiles({
      students: [
        { id: "a", studyYear: 1, section: "A" },
        { id: "b", studyYear: 2, section: "B" },
      ],
      surveyRisks: [
        { studentId: "a", riskLevel: RiskLevel.NORMAL, at: new Date("2026-01-01") },
        { studentId: "a", riskLevel: RiskLevel.HIGH, at: new Date("2026-02-01") },
      ],
      assessmentRisks: [
        { studentId: "b", riskLevel: RiskLevel.MEDIUM, at: new Date("2026-01-15") },
      ],
      wellness: [
        { studentId: "a", signalCode: WellnessTrendSignalCode.DEPRESSIVE_THEME },
        { studentId: "a", signalCode: WellnessTrendSignalCode.DEPRESSIVE_THEME },
      ],
    });

    assert.equal(profiles.length, 2);
    const a = profiles.find((item) => item.id === "a");
    const b = profiles.find((item) => item.id === "b");
    assert.equal(a?.priorRiskLevel, RiskLevel.HIGH);
    assert.deepEqual(a?.wellnessSignalCodes, [WellnessTrendSignalCode.DEPRESSIVE_THEME]);
    assert.equal(b?.priorRiskLevel, RiskLevel.MEDIUM);

    const matched = countEligibleStudents(profiles, {
      audienceType: SurveyAudienceType.RULE_BASED,
      rule: {
        priorRiskLevels: [RiskLevel.HIGH],
        wellnessSignalCodes: [WellnessTrendSignalCode.DEPRESSIVE_THEME],
        studyYears: [],
        sections: [],
      },
    });
    assert.equal(matched, 1);
    assert.deepEqual(
      filterEligibleStudentIds(profiles, {
        audienceType: SurveyAudienceType.RULE_BASED,
        rule: {
          priorRiskLevels: [RiskLevel.HIGH],
          wellnessSignalCodes: [],
          studyYears: [],
          sections: [],
        },
      }),
      ["a"]
    );
  });
});

describe("blind semantics helpers", () => {
  it("eligibility helpers never encode reveal reasons in return values", () => {
    const eligible = isStudentEligibleForAudience(baseProfile(), {
      audienceType: SurveyAudienceType.RULE_BASED,
      rule: {
        priorRiskLevels: [RiskLevel.MEDIUM],
        wellnessSignalCodes: [],
        studyYears: [],
        sections: [],
      },
    });
    assert.equal(typeof eligible, "boolean");
    assert.equal(eligible, true);
  });
});
