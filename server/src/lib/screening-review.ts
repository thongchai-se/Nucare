import {
  AlertPriority,
  AlertStatus,
  AlertType,
  Prisma,
  ReferralStatus,
  ReferralTarget,
  RiskLevel,
  Role,
} from "@prisma/client";
import { canAccessStudent } from "./access-control";
import {
  ACTIVE_REFERRAL_STATUSES,
  activeReferralConflictMessage,
  isActiveReferralStatus,
} from "./active-referral";
import { writeAuditLog } from "./audit-log";
import { formatAuditMetadata } from "./audit-metadata";
import { prisma } from "./prisma";
import { buildUserHasRoleWhere, hasAssignedRole } from "./roles";
import { formatStudentIdForResponse, inferStudyYear, normalizeRiskLevel } from "./user-format";

/** ระดับความเสี่ยงที่เข้าคิวทบทวน (ไม่รวม NORMAL) */
export const SCREENING_REVIEW_RISK_LEVELS: readonly RiskLevel[] = [RiskLevel.HIGH, RiskLevel.MEDIUM];

/** คลื่นล่าสุดที่นับเป็น "ล่าสุด" สำหรับคิว (วัน) */
export const SCREENING_REVIEW_RECENT_DAYS = 90;

/** เพดานแถวผู้สมัครคิวต่อคำขอ — กันตอบช้า/หน่วยความจำบวม */
export const SCREENING_REVIEW_MAX_CANDIDATES = 1000;

/** ชื่อ action ใน audit log (ใช้ derive สถานะ "รับทราบแล้ว") */
export const SCREENING_REVIEW_ACK_ACTION = "screening-review.acknowledge";
export const SCREENING_REVIEW_VIEW_ACTION = "screening-review.view-detail";
export const SCREENING_REVIEW_REFER_ACTION = "screening-review.refer";

export const SCREENING_REVIEW_SOURCE_TYPE = "SurveyResponse";

export type ScreeningReviewScope = "all" | "advisees" | "none";
export type ScreeningReviewViewer = "advisor" | "staff";
export type ScreeningReviewStatus = "PENDING" | "ACKNOWLEDGED" | "REFERRED";
export type ScreeningReviewStatusFilter = ScreeningReviewStatus | "OPEN" | "ALL";

export type ScreeningReviewReferralInfo = {
  id: string;
  target: ReferralTarget;
  status: ReferralStatus;
};

export type ScreeningReviewItem = {
  responseId: string;
  studentUserId: string;
  studentCode: string | null;
  studentName: string;
  year: string;
  section: string;
  advisorName: string | null;
  riskLevel: "high" | "medium";
  surveyTitle: string;
  waveLabel: string;
  submittedAt: Date;
  status: ScreeningReviewStatus;
  acknowledgedAt: Date | null;
  activeReferrals: ScreeningReviewReferralInfo[];
};

// ---------------------------------------------------------------------------
// ตัวช่วยบริสุทธิ์ (ไม่แตะ DB) — ครอบคลุมด้วย screening-review.test.ts
// ---------------------------------------------------------------------------

/** ตรวจว่าระดับความเสี่ยงอยู่ในเกณฑ์เข้าคิวทบทวน (MEDIUM/HIGH เท่านั้น) */
export function isScreeningReviewRisk(level: RiskLevel): boolean {
  return level === RiskLevel.MEDIUM || level === RiskLevel.HIGH;
}

/**
 * กำหนดขอบเขตคิวตามบทบาท: ที่ปรึกษา = เฉพาะที่ปรึกษาของตน, พัฒนานิสิต/แอดมิน = ทั้งหมด,
 * สุขภาพจิต/บทบาทอื่น = ไม่มีคิวอัตโนมัติ (deny by default)
 */
export function resolveScreeningReviewScope(
  roles: readonly Role[] | undefined,
  viewer?: ScreeningReviewViewer
): ScreeningReviewScope {
  const isAdvisor = hasAssignedRole(roles ? [...roles] : undefined, Role.ADVISOR);
  const isStaff =
    hasAssignedRole(roles ? [...roles] : undefined, Role.STUDENT_DEVELOPMENT) ||
    hasAssignedRole(roles ? [...roles] : undefined, Role.ADMIN);

  if (viewer === "advisor") {
    return isAdvisor ? "advisees" : "none";
  }
  if (viewer === "staff") {
    return isStaff ? "all" : "none";
  }
  if (isStaff) {
    return "all";
  }
  return isAdvisor ? "advisees" : "none";
}

/** กรองระดับความเสี่ยงที่ขอมาให้เหลือเฉพาะ MEDIUM/HIGH — ไม่ส่งมา = ทั้งสองระดับ */
export function resolveScreeningReviewRiskLevels(requested?: readonly RiskLevel[]): RiskLevel[] {
  if (!requested || requested.length === 0) {
    return [...SCREENING_REVIEW_RISK_LEVELS];
  }
  const allowed = new Set<RiskLevel>(SCREENING_REVIEW_RISK_LEVELS);
  return Array.from(new Set(requested.filter((level) => allowed.has(level))));
}

/** จุดตัดเวลาของ "คลื่นล่าสุด" */
export function resolveScreeningReviewCutoff(
  now: Date = new Date(),
  days: number = SCREENING_REVIEW_RECENT_DAYS
): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

const RISK_RANK: Record<RiskLevel, number> = {
  [RiskLevel.HIGH]: 2,
  [RiskLevel.MEDIUM]: 1,
  [RiskLevel.NORMAL]: 0,
};

type ReviewCandidate = {
  responseId: string;
  studentId: string;
  surveyId: string;
  riskLevel: RiskLevel;
  submittedAt: Date;
};

/**
 * เลือกเฉพาะผลที่ยังเป็น "ล่าสุดของแบบประเมินนั้น" (ผลใหม่กว่าที่ปกติจะแทนที่ผลเสี่ยงเก่า)
 * แล้วเหลือหนึ่งแถวต่อนิสิต (ความเสี่ยงสูงกว่า/ใหม่กว่าชนะ) — O(n) ด้วย Map
 */
export function selectCurrentScreeningReviews<T extends ReviewCandidate>(
  candidates: readonly T[],
  latestSubmittedAtByStudentSurvey: ReadonlyMap<string, number>
): T[] {
  const bestByStudent = new Map<string, T>();

  for (const candidate of candidates) {
    const latest = latestSubmittedAtByStudentSurvey.get(
      studentSurveyKey(candidate.studentId, candidate.surveyId)
    );
    if (latest !== undefined && candidate.submittedAt.getTime() < latest) {
      continue;
    }

    const current = bestByStudent.get(candidate.studentId);
    if (!current) {
      bestByStudent.set(candidate.studentId, candidate);
      continue;
    }

    const rankDiff = RISK_RANK[candidate.riskLevel] - RISK_RANK[current.riskLevel];
    if (
      rankDiff > 0 ||
      (rankDiff === 0 && candidate.submittedAt.getTime() > current.submittedAt.getTime())
    ) {
      bestByStudent.set(candidate.studentId, candidate);
    }
  }

  return Array.from(bestByStudent.values());
}

/** คีย์รวมนิสิต+แบบประเมิน สำหรับเทียบ "ผลล่าสุดของแบบนั้น" */
export function studentSurveyKey(studentId: string, surveyId: string): string {
  return `${studentId}:${surveyId}`;
}

/** สถานะคิว: มีเคสส่งต่อที่ยังเปิดอยู่ = REFERRED, รับทราบแล้ว = ACKNOWLEDGED, นอกนั้น PENDING */
export function deriveScreeningReviewStatus(input: {
  activeReferrals: readonly { status: ReferralStatus }[];
  acknowledged: boolean;
}): ScreeningReviewStatus {
  if (input.activeReferrals.some((referral) => isActiveReferralStatus(referral.status))) {
    return "REFERRED";
  }
  return input.acknowledged ? "ACKNOWLEDGED" : "PENDING";
}

/** ตัวกรองสถานะ: ค่าเริ่มต้น OPEN = ยังไม่ส่งต่อ (รอ + รับทราบแล้ว) */
export function matchesScreeningReviewStatus(
  status: ScreeningReviewStatus,
  filter: ScreeningReviewStatusFilter = "OPEN"
): boolean {
  if (filter === "ALL") {
    return true;
  }
  if (filter === "OPEN") {
    return status !== "REFERRED";
  }
  return status === filter;
}

/** เรียง HIGH ก่อน แล้วใหม่ไปเก่า */
export function compareScreeningReviews(
  left: Pick<ScreeningReviewItem, "riskLevel" | "submittedAt">,
  right: Pick<ScreeningReviewItem, "riskLevel" | "submittedAt">
): number {
  const riskDiff = Number(right.riskLevel === "high") - Number(left.riskLevel === "high");
  if (riskDiff !== 0) {
    return riskDiff;
  }
  return right.submittedAt.getTime() - left.submittedAt.getTime();
}

/** ปลายทางส่งต่อที่ผู้ใช้ในขอบเขตนั้นสร้างได้ — พัฒนานิสิตส่งต่อไปงานพัฒนานิสิตเองไม่ได้ */
export function allowedScreeningReferralTargets(
  scope: ScreeningReviewScope,
  roles: readonly Role[] | undefined
): ReferralTarget[] {
  if (scope === "advisees") {
    return [ReferralTarget.STUDENT_DEVELOPMENT, ReferralTarget.COUNSELING_CENTER];
  }
  if (scope === "all") {
    return hasAssignedRole(roles ? [...roles] : undefined, Role.ADMIN)
      ? [ReferralTarget.STUDENT_DEVELOPMENT, ReferralTarget.COUNSELING_CENTER]
      : [ReferralTarget.COUNSELING_CENTER];
  }
  return [];
}

/** หาเคสส่งต่อที่ยังเปิดอยู่ใน target เดียวกัน (ใช้เหมือน active-referral dedupe) */
export function findBlockingReferral(
  referrals: readonly ScreeningReviewReferralInfo[],
  target: ReferralTarget
): ScreeningReviewReferralInfo | null {
  return (
    referrals.find(
      (referral) => referral.target === target && isActiveReferralStatus(referral.status)
    ) ?? null
  );
}

/** แปลงแถวตอบแบบเป็นรายการคิว (ปรับรูปแบบรหัสนิสิต/ปี/ความเสี่ยงให้เหมือนแดชบอร์ดอื่น) */
export function toScreeningReviewItem(input: {
  response: {
    id: string;
    riskLevel: RiskLevel;
    submittedAt: Date;
    survey: { title: string };
    wave: { label: string };
    student: {
      id: string;
      name: string;
      studentId: string | null;
      studyYear: number | null;
      section: string | null;
      studentAssignments?: { advisor: { name: string } }[];
    };
  };
  activeReferrals: ScreeningReviewReferralInfo[];
  acknowledgedAt: Date | null;
}): ScreeningReviewItem {
  const { response } = input;
  return {
    responseId: response.id,
    studentUserId: response.student.id,
    studentCode: formatStudentIdForResponse(response.student.studentId),
    studentName: response.student.name,
    year: inferStudyYear(response.student.studentId, response.student.studyYear),
    section: response.student.section || "-",
    advisorName: response.student.studentAssignments?.[0]?.advisor.name ?? null,
    riskLevel: normalizeRiskLevel(response.riskLevel) === "high" ? "high" : "medium",
    surveyTitle: response.survey.title,
    waveLabel: response.wave.label,
    submittedAt: response.submittedAt,
    status: deriveScreeningReviewStatus({
      activeReferrals: input.activeReferrals,
      acknowledged: input.acknowledgedAt !== null,
    }),
    acknowledgedAt: input.acknowledgedAt,
    activeReferrals: input.activeReferrals,
  };
}

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------

/** เงื่อนไขนิสิตตามขอบเขตคิว — ที่ปรึกษาเห็นเฉพาะนิสิตในความดูแล (กรองใน SQL ไม่ดึงทั้งหมดมากรอง) */
function buildStudentWhere(scope: ScreeningReviewScope, actorUserId: string): Prisma.UserWhereInput {
  if (scope === "advisees") {
    return {
      role: Role.STUDENT,
      isActive: true,
      studentAssignments: { some: { advisorId: actorUserId, isActive: true } },
    };
  }
  if (scope === "all") {
    return { role: Role.STUDENT, isActive: true };
  }
  return { id: "__no_student_scope__" };
}

/** จำกัดว่าผู้เรียกเข้าถึงนิสิตของผลนั้นได้หรือไม่ (กัน IDOR) */
async function canReviewStudent(
  scope: ScreeningReviewScope,
  actorUserId: string,
  studentId: string
): Promise<boolean> {
  if (scope === "all") {
    return true;
  }
  if (scope === "advisees") {
    return canAccessStudent(Role.ADVISOR, actorUserId, studentId);
  }
  return false;
}

/**
 * รายการผลคัดกรอง MEDIUM/HIGH จากคลื่นล่าสุดสำหรับทบทวน — ขอบเขตตามบทบาท
 * ใช้ 4 query คงที่ (ไม่มี N+1) และไม่สร้างส่งต่ออัตโนมัติจากคะแนน
 */
export async function listScreeningReviews(input: {
  actorUserId: string;
  roles: readonly Role[];
  viewer?: ScreeningReviewViewer;
  riskLevels?: readonly RiskLevel[];
  status?: ScreeningReviewStatusFilter;
  now?: Date;
}): Promise<{ scope: ScreeningReviewScope; items: ScreeningReviewItem[]; truncated: boolean }> {
  const scope = resolveScreeningReviewScope(input.roles, input.viewer);
  const riskLevels = resolveScreeningReviewRiskLevels(input.riskLevels);
  if (scope === "none" || riskLevels.length === 0) {
    return { scope, items: [], truncated: false };
  }

  const cutoff = resolveScreeningReviewCutoff(input.now);
  const rows = await prisma.surveyResponse.findMany({
    where: {
      riskLevel: { in: riskLevels },
      submittedAt: { gte: cutoff },
      student: buildStudentWhere(scope, input.actorUserId),
    },
    orderBy: { submittedAt: "desc" },
    take: SCREENING_REVIEW_MAX_CANDIDATES,
    select: {
      id: true,
      studentId: true,
      surveyId: true,
      riskLevel: true,
      submittedAt: true,
      survey: { select: { title: true } },
      wave: { select: { label: true } },
      student: {
        select: {
          id: true,
          name: true,
          studentId: true,
          studyYear: true,
          section: true,
          studentAssignments: {
            where: { isActive: true },
            take: 1,
            select: { advisor: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (rows.length === 0) {
    return { scope, items: [], truncated: false };
  }

  const studentIds = Array.from(new Set(rows.map((row) => row.studentId)));

  const [latestGroups, referralRows] = await Promise.all([
    prisma.surveyResponse.groupBy({
      by: ["studentId", "surveyId"],
      where: { studentId: { in: studentIds }, submittedAt: { gte: cutoff } },
      _max: { submittedAt: true },
    }),
    prisma.caseReferral.findMany({
      where: { studentId: { in: studentIds }, status: { in: ACTIVE_REFERRAL_STATUSES } },
      select: { id: true, studentId: true, target: true, status: true },
    }),
  ]);

  const latestByStudentSurvey = new Map<string, number>();
  for (const group of latestGroups) {
    if (group._max.submittedAt) {
      latestByStudentSurvey.set(
        studentSurveyKey(group.studentId, group.surveyId),
        group._max.submittedAt.getTime()
      );
    }
  }

  const current = selectCurrentScreeningReviews(
    rows.map((row) => ({ ...row, responseId: row.id })),
    latestByStudentSurvey
  );

  const referralsByStudent = new Map<string, ScreeningReviewReferralInfo[]>();
  for (const referral of referralRows) {
    const list = referralsByStudent.get(referral.studentId) ?? [];
    list.push({ id: referral.id, target: referral.target, status: referral.status });
    referralsByStudent.set(referral.studentId, list);
  }

  const ackRows = await prisma.auditLog.findMany({
    where: {
      actorUserId: input.actorUserId,
      action: SCREENING_REVIEW_ACK_ACTION,
      entityType: SCREENING_REVIEW_SOURCE_TYPE,
      entityId: { in: current.map((row) => row.id) },
    },
    select: { entityId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const ackByResponseId = new Map<string, Date>();
  for (const ack of ackRows) {
    if (ack.entityId && !ackByResponseId.has(ack.entityId)) {
      ackByResponseId.set(ack.entityId, ack.createdAt);
    }
  }

  const statusFilter = input.status ?? "OPEN";
  const items = current
    .map((row) =>
      toScreeningReviewItem({
        response: row,
        activeReferrals: referralsByStudent.get(row.studentId) ?? [],
        acknowledgedAt: ackByResponseId.get(row.id) ?? null,
      })
    )
    .filter((item) => matchesScreeningReviewStatus(item.status, statusFilter))
    .sort(compareScreeningReviews);

  return { scope, items, truncated: rows.length >= SCREENING_REVIEW_MAX_CANDIDATES };
}

type ReviewResponseHead = {
  id: string;
  studentId: string;
  riskLevel: RiskLevel;
};

/** โหลดหัวผลตอบแบบ + ตรวจสิทธิ์ — ไม่พบหรือไม่มีสิทธิ์ให้ผลเหมือนกัน (ไม่เปิดเผยการมีอยู่) */
async function loadAuthorizedResponse(input: {
  actorUserId: string;
  roles: readonly Role[];
  viewer?: ScreeningReviewViewer;
  responseId: string;
}): Promise<
  { ok: true; scope: ScreeningReviewScope; response: ReviewResponseHead } | { ok: false; code: "NOT_FOUND" | "NOT_ELIGIBLE" }
> {
  const scope = resolveScreeningReviewScope(input.roles, input.viewer);
  if (scope === "none") {
    return { ok: false, code: "NOT_FOUND" };
  }

  const response = await prisma.surveyResponse.findFirst({
    where: {
      id: input.responseId,
      student: { role: Role.STUDENT, isActive: true },
    },
    select: { id: true, studentId: true, riskLevel: true },
  });
  if (!response) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (!(await canReviewStudent(scope, input.actorUserId, response.studentId))) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (!isScreeningReviewRisk(response.riskLevel)) {
    return { ok: false, code: "NOT_ELIGIBLE" };
  }

  return { ok: true, scope, response };
}

export type AcknowledgeScreeningReviewResult =
  | { ok: true; alreadyAcknowledged: boolean }
  | { ok: false; code: "NOT_FOUND" | "NOT_ELIGIBLE" };

/**
 * รับทราบผลคัดกรองของผู้เรียก (ต่อผู้ใช้) — เขียน audit และปิดสถานะ OPEN ของแจ้งเตือนต้นทางของตนเองเท่านั้น
 * เรียกซ้ำปลอดภัย (idempotent)
 */
export async function acknowledgeScreeningReview(input: {
  actorUserId: string;
  roles: readonly Role[];
  viewer?: ScreeningReviewViewer;
  responseId: string;
  ipAddress?: string | null;
}): Promise<AcknowledgeScreeningReviewResult> {
  const loaded = await loadAuthorizedResponse(input);
  if (!loaded.ok) {
    return loaded;
  }

  const existing = await prisma.auditLog.findFirst({
    where: {
      actorUserId: input.actorUserId,
      action: SCREENING_REVIEW_ACK_ACTION,
      entityType: SCREENING_REVIEW_SOURCE_TYPE,
      entityId: loaded.response.id,
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, alreadyAcknowledged: true };
  }

  await prisma.alert.updateMany({
    where: {
      recipientUserId: input.actorUserId,
      sourceType: SCREENING_REVIEW_SOURCE_TYPE,
      sourceId: loaded.response.id,
      status: AlertStatus.OPEN,
    },
    data: { status: AlertStatus.ACKNOWLEDGED, acknowledgedAt: new Date() },
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: SCREENING_REVIEW_ACK_ACTION,
    entityType: SCREENING_REVIEW_SOURCE_TYPE,
    entityId: loaded.response.id,
    description: formatAuditMetadata({ op: "acknowledge_screening_review" }),
    ipAddress: input.ipAddress,
  });

  return { ok: true, alreadyAcknowledged: false };
}

export type ScreeningReviewDetail = {
  responseId: string;
  student: {
    id: string;
    name: string;
    studentCode: string | null;
    year: string;
    section: string;
  };
  surveyTitle: string;
  waveLabel: string;
  riskLevel: "high" | "medium";
  instrument: string | null;
  totalScore: number | null;
  maxScore: number;
  scorePercent: number | null;
  submittedAt: Date;
  answers: { questionId: string; prompt: string; order: number; value: unknown }[];
};

/**
 * รายละเอียดผลคัดกรองรวมคำตอบ — เฉพาะผู้ตรวจที่มีสิทธิ์ต่อนิสิตคนนั้น
 * เขียน audit การเปิดดูข้อมูลละเอียดอ่อน ไม่ส่ง scoringSnapshot ออก
 */
export async function getScreeningReviewDetail(input: {
  actorUserId: string;
  roles: readonly Role[];
  viewer?: ScreeningReviewViewer;
  responseId: string;
  ipAddress?: string | null;
}): Promise<{ ok: true; detail: ScreeningReviewDetail } | { ok: false; code: "NOT_FOUND" | "NOT_ELIGIBLE" }> {
  const loaded = await loadAuthorizedResponse(input);
  if (!loaded.ok) {
    return loaded;
  }

  const response = await prisma.surveyResponse.findUnique({
    where: { id: loaded.response.id },
    select: {
      id: true,
      riskLevel: true,
      instrument: true,
      totalScore: true,
      maxScore: true,
      scorePercent: true,
      submittedAt: true,
      survey: { select: { title: true } },
      wave: { select: { label: true } },
      student: {
        select: { id: true, name: true, studentId: true, studyYear: true, section: true },
      },
      answers: {
        select: { questionId: true, value: true, question: { select: { prompt: true, order: true } } },
      },
    },
  });
  if (!response) {
    return { ok: false, code: "NOT_FOUND" };
  }

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: SCREENING_REVIEW_VIEW_ACTION,
    entityType: SCREENING_REVIEW_SOURCE_TYPE,
    entityId: response.id,
    description: formatAuditMetadata({ op: "view_screening_review_detail" }),
    ipAddress: input.ipAddress,
  });

  return {
    ok: true,
    detail: {
      responseId: response.id,
      student: {
        id: response.student.id,
        name: response.student.name,
        studentCode: formatStudentIdForResponse(response.student.studentId),
        year: inferStudyYear(response.student.studentId, response.student.studyYear),
        section: response.student.section || "-",
      },
      surveyTitle: response.survey.title,
      waveLabel: response.wave.label,
      riskLevel: response.riskLevel === RiskLevel.HIGH ? "high" : "medium",
      instrument: response.instrument,
      totalScore: response.totalScore,
      maxScore: response.maxScore,
      scorePercent: response.scorePercent,
      submittedAt: response.submittedAt,
      answers: response.answers
        .map((answer) => ({
          questionId: answer.questionId,
          prompt: answer.question.prompt,
          order: answer.question.order,
          value: answer.value,
        }))
        .sort((left, right) => left.order - right.order),
    },
  };
}

export type CreateReferralFromScreeningResult =
  | {
      ok: true;
      referral: {
        id: string;
        target: ReferralTarget;
        reason: string;
        isUrgent: boolean;
        status: ReferralStatus;
        createdAt: Date;
      };
    }
  | { ok: false; code: "NOT_FOUND" | "NOT_ELIGIBLE" | "FORBIDDEN_TARGET" | "ACTIVE_REFERRAL"; message: string };

/**
 * สร้างส่งต่อจากผลคัดกรองโดยผู้ตรวจ (มนุษย์เท่านั้น) — กันซ้ำเฉพาะ target เดียวกันด้วย active-referral
 * บันทึก sourceType=SurveyResponse/sourceId, แจ้งทีมปลายทาง และเขียน audit
 */
export async function createReferralFromScreening(input: {
  actorUserId: string;
  roles: readonly Role[];
  viewer?: ScreeningReviewViewer;
  responseId: string;
  target: ReferralTarget;
  reason: string;
  isUrgent?: boolean;
  ipAddress?: string | null;
}): Promise<CreateReferralFromScreeningResult> {
  const loaded = await loadAuthorizedResponse(input);
  if (!loaded.ok) {
    return {
      ok: false,
      code: loaded.code,
      message: loaded.code === "NOT_ELIGIBLE" ? "ผลนี้ไม่อยู่ในคิวทบทวน" : "ไม่พบผลคัดกรอง",
    };
  }

  if (!allowedScreeningReferralTargets(loaded.scope, input.roles).includes(input.target)) {
    return { ok: false, code: "FORBIDDEN_TARGET", message: "ไม่มีสิทธิ์ส่งต่อไปปลายทางนี้" };
  }

  const reason = input.reason.trim();
  const isUrgent = Boolean(input.isUrgent);
  const studentId = loaded.response.studentId;

  let referral: Extract<CreateReferralFromScreeningResult, { ok: true }>["referral"];
  try {
    referral = await prisma.$transaction(
      async (tx) => {
        const open = await tx.caseReferral.findFirst({
          where: { studentId, target: input.target, status: { in: ACTIVE_REFERRAL_STATUSES } },
          select: { id: true, status: true, target: true },
          orderBy: { createdAt: "desc" },
        });
        if (open && isActiveReferralStatus(open.status)) {
          const error = new Error(activeReferralConflictMessage(open.status, open.target));
          (error as Error & { code?: string }).code = "ACTIVE_REFERRAL";
          throw error;
        }

        return tx.caseReferral.create({
          data: {
            studentId,
            advisorId: input.actorUserId,
            target: input.target,
            reason,
            isUrgent,
            sourceType: SCREENING_REVIEW_SOURCE_TYPE,
            sourceId: loaded.response.id,
          },
          select: {
            id: true,
            target: true,
            reason: true,
            isUrgent: true,
            status: true,
            createdAt: true,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (error instanceof Error && (error as Error & { code?: string }).code === "ACTIVE_REFERRAL") {
      return { ok: false, code: "ACTIVE_REFERRAL", message: error.message };
    }
    throw error;
  }

  const recipientRole =
    input.target === ReferralTarget.COUNSELING_CENTER ? Role.MENTAL_HEALTH : Role.STUDENT_DEVELOPMENT;
  const recipients = await prisma.user.findMany({
    where: { AND: [buildUserHasRoleWhere(recipientRole), { isActive: true }] },
    select: { id: true },
  });
  if (recipients.length > 0) {
    await prisma.alert.createMany({
      data: recipients.map((user) => ({
        recipientUserId: user.id,
        actorUserId: input.actorUserId,
        studentId,
        type: AlertType.REFERRAL_RECEIVED,
        priority: isUrgent ? AlertPriority.HIGH : AlertPriority.MEDIUM,
        title: "มีเคสส่งต่อใหม่",
        message: reason,
        sourceType: "CaseReferral",
        sourceId: referral.id,
      })),
    });
  }

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: SCREENING_REVIEW_REFER_ACTION,
    entityType: "CaseReferral",
    entityId: referral.id,
    description: formatAuditMetadata({
      op: "refer_from_screening",
      sourceType: SCREENING_REVIEW_SOURCE_TYPE,
      sourceId: loaded.response.id,
      target: input.target,
      urgent: isUrgent,
    }),
    ipAddress: input.ipAddress,
  });

  return { ok: true, referral };
}
