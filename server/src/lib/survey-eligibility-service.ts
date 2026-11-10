import {
  Prisma,
  RiskLevel,
  Role,
  SurveyAudienceType,
  SurveyWaveStatus,
  WellnessTrendSignalCode,
} from "@prisma/client";
import { prisma } from "./prisma";
import {
  buildEligibilityProfiles,
  countEligibleStudents,
  filterEligibleStudentIds,
  isStudentEligibleForAudience,
  type AudienceConfig,
  type EligibilityRuleInput,
} from "./survey-eligibility";

type Tx = Prisma.TransactionClient | typeof prisma;

const emptyRule = (): EligibilityRuleInput => ({
  priorRiskLevels: [],
  wellnessSignalCodes: [],
  studyYears: [],
  sections: [],
});

/** แปลงกฎจาก DB เป็นโครงสร้างประเมินสิทธิ์ */
export function toEligibilityRuleInput(rule: {
  priorRiskLevels: RiskLevel[];
  wellnessSignalCodes: WellnessTrendSignalCode[];
  studyYears: number[];
  sections: string[];
} | null): EligibilityRuleInput {
  if (!rule) {
    return emptyRule();
  }

  return {
    priorRiskLevels: rule.priorRiskLevels,
    wellnessSignalCodes: rule.wellnessSignalCodes,
    studyYears: rule.studyYears,
    sections: rule.sections.map((item) => item.trim()).filter(Boolean),
  };
}

/** โหลดโปรไฟล์นักศึกษาทั้งหมดแบบ batch สำหรับประเมินสิทธิ์ — O(n) */
export async function loadAllStudentEligibilityProfiles(db: Tx = prisma) {
  const students = await db.user.findMany({
    where: {
      role: Role.STUDENT,
      isActive: true,
    },
    select: {
      id: true,
      studyYear: true,
      section: true,
    },
  });

  if (students.length === 0) {
    return [];
  }

  const studentIds = students.map((student) => student.id);

  const [surveyRisks, assessmentRisks, wellness] = await Promise.all([
    db.surveyResponse.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        riskLevel: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: "desc" },
    }),
    db.studentAssessment.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        riskLevel: true,
        assessedAt: true,
      },
      orderBy: { assessedAt: "desc" },
    }),
    db.studentWellnessTrendSummary.findMany({
      where: { studentId: { in: studentIds } },
      select: {
        studentId: true,
        signalCode: true,
      },
    }),
  ]);

  return buildEligibilityProfiles({
    students,
    surveyRisks: surveyRisks.map((row) => ({
      studentId: row.studentId,
      riskLevel: row.riskLevel,
      at: row.submittedAt,
    })),
    assessmentRisks: assessmentRisks.map((row) => ({
      studentId: row.studentId,
      riskLevel: row.riskLevel,
      at: row.assessedAt,
    })),
    wellness,
  });
}

/** นับจำนวนนักศึกษาที่เข้าเกณฑ์ของแบบ — ไม่คืนรายชื่อ */
export async function previewEligibilityCount(input: {
  audienceType: SurveyAudienceType;
  rule: EligibilityRuleInput | null;
}): Promise<number> {
  const profiles = await loadAllStudentEligibilityProfiles();
  return countEligibleStudents(profiles, {
    audienceType: input.audienceType,
    rule: input.rule,
  });
}

/** สร้าง/ซิงก์ SurveyAssignment ของคลื่นตาม audience — O(n) */
export async function syncWaveAssignments(input: {
  waveId: string;
  audienceType: SurveyAudienceType;
  rule: EligibilityRuleInput | null;
  db?: Tx;
}): Promise<{ assignedCount: number }> {
  const db = input.db ?? prisma;
  const profiles = await loadAllStudentEligibilityProfiles(db);
  const eligibleIds = filterEligibleStudentIds(profiles, {
    audienceType: input.audienceType,
    rule: input.rule,
  });

  const eligibleSet = new Set(eligibleIds);
  const existing = await db.surveyAssignment.findMany({
    where: { waveId: input.waveId },
    select: {
      id: true,
      studentId: true,
      completedAt: true,
    },
  });

  const existingByStudent = new Map(existing.map((row) => [row.studentId, row]));
  const toCreate = eligibleIds.filter((studentId) => !existingByStudent.has(studentId));
  const toDelete = existing
    .filter((row) => !eligibleSet.has(row.studentId) && !row.completedAt)
    .map((row) => row.id);

  if (toDelete.length > 0) {
    await db.surveyAssignment.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  if (toCreate.length > 0) {
    const now = new Date();
    await db.surveyAssignment.createMany({
      data: toCreate.map((studentId) => ({
        waveId: input.waveId,
        studentId,
        eligibleAt: now,
      })),
      skipDuplicates: true,
    });
  }

  return { assignedCount: eligibleIds.length };
}

/** ตรวจว่านักศึกษาคนนี้เข้าทำคลื่นนี้ได้หรือไม่ (ไม่ leak เหตุผล) */
export async function studentHasOpenAssignment(input: {
  studentId: string;
  surveyId: string;
  waveId?: string;
}): Promise<{ waveId: string; assignmentId: string } | null> {
  const now = new Date();
  const assignment = await prisma.surveyAssignment.findFirst({
    where: {
      studentId: input.studentId,
      completedAt: null,
      wave: {
        surveyId: input.surveyId,
        ...(input.waveId ? { id: input.waveId } : {}),
        status: SurveyWaveStatus.OPEN,
        opensAt: { lte: now },
        OR: [{ closesAt: null }, { closesAt: { gte: now } }],
      },
    },
    select: {
      id: true,
      waveId: true,
    },
    orderBy: {
      eligibleAt: "desc",
    },
  });

  if (!assignment) {
    return null;
  }

  return { waveId: assignment.waveId, assignmentId: assignment.id };
}

/** ตรวจสิทธิ์รายคนแบบ live (กรณี ALL หรือเพิ่งเข้าเกณฑ์หลัง sync) */
export async function ensureStudentAssignmentIfEligible(input: {
  studentId: string;
  waveId: string;
  audienceType: SurveyAudienceType;
  rule: EligibilityRuleInput | null;
}): Promise<boolean> {
  const existing = await prisma.surveyAssignment.findUnique({
    where: {
      waveId_studentId: {
        waveId: input.waveId,
        studentId: input.studentId,
      },
    },
    select: { id: true, completedAt: true },
  });

  if (existing?.completedAt) {
    return false;
  }
  if (existing) {
    return true;
  }

  const student = await prisma.user.findFirst({
    where: { id: input.studentId, role: Role.STUDENT, isActive: true },
    select: { id: true, studyYear: true, section: true },
  });
  if (!student) {
    return false;
  }

  const [latestSurvey, latestAssessment, wellness] = await Promise.all([
    prisma.surveyResponse.findFirst({
      where: { studentId: student.id },
      orderBy: { submittedAt: "desc" },
      select: { riskLevel: true, submittedAt: true },
    }),
    prisma.studentAssessment.findFirst({
      where: { studentId: student.id },
      orderBy: { assessedAt: "desc" },
      select: { riskLevel: true, assessedAt: true },
    }),
    prisma.studentWellnessTrendSummary.findMany({
      where: { studentId: student.id },
      select: { signalCode: true },
    }),
  ]);

  const profiles = buildEligibilityProfiles({
    students: [student],
    surveyRisks: latestSurvey
      ? [{ studentId: student.id, riskLevel: latestSurvey.riskLevel, at: latestSurvey.submittedAt }]
      : [],
    assessmentRisks: latestAssessment
      ? [
          {
            studentId: student.id,
            riskLevel: latestAssessment.riskLevel,
            at: latestAssessment.assessedAt,
          },
        ]
      : [],
    wellness: wellness.map((row) => ({
      studentId: student.id,
      signalCode: row.signalCode,
    })),
  });

  const config: AudienceConfig = {
    audienceType: input.audienceType,
    rule: input.rule,
  };

  if (!isStudentEligibleForAudience(profiles[0], config)) {
    return false;
  }

  await prisma.surveyAssignment.create({
    data: {
      waveId: input.waveId,
      studentId: student.id,
    },
  });

  return true;
}
