import {
  RiskLevel,
  Role,
  SurveyAudienceType,
  WellnessTrendSignalCode,
} from "@prisma/client";

/** โปรไฟล์นักศึกษาที่ใช้ตัดสินสิทธิ์เข้าทำแบบ — ไม่ส่งออกนอกเซิร์ฟเวอร์ */
export type EligibilityStudentProfile = {
  id: string;
  studyYear: number | null;
  section: string | null;
  /** ความเสี่ยงสูงสุดจากผลแบบประเมิน/คัดกรองล่าสุด (null = ยังไม่มีผล) */
  priorRiskLevel: RiskLevel | null;
  wellnessSignalCodes: WellnessTrendSignalCode[];
};

/** กฎคัดเลือกกลุ่มเป้าหมายของแบบประเมิน */
export type EligibilityRuleInput = {
  priorRiskLevels: RiskLevel[];
  wellnessSignalCodes: WellnessTrendSignalCode[];
  studyYears: number[];
  sections: string[];
};

export type AudienceConfig = {
  audienceType: SurveyAudienceType;
  rule: EligibilityRuleInput | null;
};

const RISK_RANK: Record<RiskLevel, number> = {
  [RiskLevel.NORMAL]: 0,
  [RiskLevel.MEDIUM]: 1,
  [RiskLevel.HIGH]: 2,
};

/** เลือกระดับเสี่ยงที่รุนแรงกว่าจากสองค่า (null ถือว่าต่ำสุด) */
export function pickHigherRisk(
  a: RiskLevel | null | undefined,
  b: RiskLevel | null | undefined
): RiskLevel | null {
  if (!a && !b) {
    return null;
  }
  if (!a) {
    return b ?? null;
  }
  if (!b) {
    return a;
  }
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

/**
 * ตรวจว่าโปรไฟล์เข้าเกณฑ์กฎหรือไม่
 * มิติที่ว่าง = ไม่กรองมิตินั้น; มิติที่มีค่าต้องผ่านทุกมิติ (AND)
 * ภายในมิติสัญญาณ/ความเสี่ยง/ปี/ตอน ใช้ OR
 */
export function matchesEligibilityRule(
  profile: EligibilityStudentProfile,
  rule: EligibilityRuleInput
): boolean {
  if (rule.studyYears.length > 0) {
    if (profile.studyYear === null || !rule.studyYears.includes(profile.studyYear)) {
      return false;
    }
  }

  if (rule.sections.length > 0) {
    const section = profile.section?.trim() || "";
    if (!section || !rule.sections.some((item) => item.trim() === section)) {
      return false;
    }
  }

  if (rule.priorRiskLevels.length > 0) {
    if (!profile.priorRiskLevel || !rule.priorRiskLevels.includes(profile.priorRiskLevel)) {
      return false;
    }
  }

  if (rule.wellnessSignalCodes.length > 0) {
    const signalSet = new Set(profile.wellnessSignalCodes);
    const matched = rule.wellnessSignalCodes.some((code) => signalSet.has(code));
    if (!matched) {
      return false;
    }
  }

  return true;
}

/** ตัดสินว่านักศึกษาเข้ากลุ่มเป้าหมายของแบบนี้หรือไม่ (ALL = ทุกคน) */
export function isStudentEligibleForAudience(
  profile: EligibilityStudentProfile,
  config: AudienceConfig
): boolean {
  if (config.audienceType === SurveyAudienceType.ALL_STUDENTS) {
    return true;
  }

  if (!config.rule) {
    return false;
  }

  const ruleIsEmpty =
    config.rule.priorRiskLevels.length === 0 &&
    config.rule.wellnessSignalCodes.length === 0 &&
    config.rule.studyYears.length === 0 &&
    config.rule.sections.length === 0;

  // RULE_BASED แต่ยังไม่ตั้งกฎเลย → ปฏิเสธทั้งหมด (deny by default)
  if (ruleIsEmpty) {
    return false;
  }

  return matchesEligibilityRule(profile, config.rule);
}

/** นับจำนวนโปรไฟล์ที่เข้าเกณฑ์ — O(n) ต่อการสแกนครั้งเดียว */
export function countEligibleStudents(
  profiles: EligibilityStudentProfile[],
  config: AudienceConfig
): number {
  let count = 0;
  for (const profile of profiles) {
    if (isStudentEligibleForAudience(profile, config)) {
      count += 1;
    }
  }
  return count;
}

/** กรองรายชื่อ studentId ที่เข้าเกณฑ์ */
export function filterEligibleStudentIds(
  profiles: EligibilityStudentProfile[],
  config: AudienceConfig
): string[] {
  const ids: string[] = [];
  for (const profile of profiles) {
    if (isStudentEligibleForAudience(profile, config)) {
      ids.push(profile.id);
    }
  }
  return ids;
}

export type RawRiskRow = {
  studentId: string;
  riskLevel: RiskLevel;
  at: Date;
};

export type RawWellnessRow = {
  studentId: string;
  signalCode: WellnessTrendSignalCode;
};

export type RawStudentRow = {
  id: string;
  studyYear: number | null;
  section: string | null;
};

/**
 * สร้างโปรไฟล์ eligibility จากแถวที่ preload แล้ว — O(n + r + w)
 * ใช้ Map เพื่อหาความเสี่ยงล่าสุดต่อคนใน O(1) หลัง sort/สแกน
 */
export function buildEligibilityProfiles(input: {
  students: RawStudentRow[];
  surveyRisks: RawRiskRow[];
  assessmentRisks: RawRiskRow[];
  wellness: RawWellnessRow[];
}): EligibilityStudentProfile[] {
  const latestRiskByStudent = new Map<string, { riskLevel: RiskLevel; at: Date }>();

  const considerRisk = (row: RawRiskRow) => {
    const current = latestRiskByStudent.get(row.studentId);
    if (!current || row.at > current.at) {
      latestRiskByStudent.set(row.studentId, { riskLevel: row.riskLevel, at: row.at });
      return;
    }
    if (row.at.getTime() === current.at.getTime()) {
      latestRiskByStudent.set(row.studentId, {
        riskLevel: pickHigherRisk(current.riskLevel, row.riskLevel) ?? row.riskLevel,
        at: row.at,
      });
    }
  };

  for (const row of input.surveyRisks) {
    considerRisk(row);
  }
  for (const row of input.assessmentRisks) {
    considerRisk(row);
  }

  const wellnessByStudent = new Map<string, Set<WellnessTrendSignalCode>>();
  for (const row of input.wellness) {
    const set = wellnessByStudent.get(row.studentId) ?? new Set<WellnessTrendSignalCode>();
    set.add(row.signalCode);
    wellnessByStudent.set(row.studentId, set);
  }

  return input.students.map((student) => ({
    id: student.id,
    studyYear: student.studyYear,
    section: student.section,
    priorRiskLevel: latestRiskByStudent.get(student.id)?.riskLevel ?? null,
    wellnessSignalCodes: Array.from(wellnessByStudent.get(student.id) ?? []),
  }));
}

/** ค่าคงที่ role นักศึกษา — ใช้ตอน query batch */
export const ELIGIBILITY_STUDENT_ROLE = Role.STUDENT;
