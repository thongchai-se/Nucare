import {
  ConsultationRequestStatus,
  EmergencyCaseStatus,
  ReferralStatus,
  ReferralTarget,
  RiskLevel,
  Role,
  type PrismaClient,
} from "@prisma/client";
import { canAccessStudent } from "./access-control";
import { stripSeedMarkers } from "./history-display";
import {
  getSensitiveStudentCard,
  type SensitiveStudentCard,
} from "./sensitive-student-detail";
import { normalizeRiskLevel } from "./user-format";

const OPEN_CONSULTATION_STATUSES: ConsultationRequestStatus[] = [
  ConsultationRequestStatus.PENDING,
  ConsultationRequestStatus.ACCEPTED,
  ConsultationRequestStatus.SCHEDULED,
  ConsultationRequestStatus.CANCEL_REQUESTED,
];

const OPEN_REFERRAL_STATUSES: ReferralStatus[] = [
  ReferralStatus.PENDING,
  ReferralStatus.ACCEPTED,
];

const OPEN_EMERGENCY_STATUSES: EmergencyCaseStatus[] = [
  EmergencyCaseStatus.OPEN,
  EmergencyCaseStatus.IN_PROGRESS,
];

export type ExecutiveConsultationByTeacher = {
  teacherId: string;
  teacherName: string;
  totalCount: number;
  openCount: number;
  closedCount: number;
  lastRequestedAt: string;
};

export type ExecutiveDossierActivityItem = {
  id: string;
  kind: "CONSULTATION" | "REFERRAL" | "CARE" | "BEHAVIOR" | "EMERGENCY" | "ASSESSMENT";
  date: string;
  type: string;
  topic: string;
  status: string | null;
  actorName: string;
  isUrgent: boolean;
};

export type ExecutiveAssessmentSnapshot = {
  assessedAt: string;
  score: number | null;
  instrument: string;
  riskLevel: ReturnType<typeof normalizeRiskLevel>;
};

export type ExecutiveStudentDossierPayload = {
  student: SensitiveStudentCard;
  consultationByTeacher: ExecutiveConsultationByTeacher[];
  consultationTotal: number;
  referrals: {
    total: number;
    open: number;
    closed: number;
    urgentOpen: number;
    recent: Array<{
      id: string;
      target: string;
      status: string;
      isUrgent: boolean;
      advisorName: string;
      createdAt: string;
    }>;
  };
  emergencies: {
    total: number;
    open: number;
    resolved: number;
    recent: Array<{
      id: string;
      status: string;
      summary: string;
      openedAt: string;
      resolvedAt: string | null;
    }>;
  };
  assessments: ExecutiveAssessmentSnapshot[];
  activity: ExecutiveDossierActivityItem[];
};

type ConsultationAggRow = {
  id: string;
  teacherId: string;
  teacherName: string;
  topic: string;
  status: ConsultationRequestStatus;
  createdAt: Date;
};

type ReferralAggRow = {
  id: string;
  target: ReferralTarget;
  status: ReferralStatus;
  isUrgent: boolean;
  advisorName: string;
  createdAt: Date;
};

type EmergencyAggRow = {
  id: string;
  status: EmergencyCaseStatus;
  summary: string;
  openedAt: Date;
  resolvedAt: Date | null;
};

type CareAggRow = {
  id: string;
  careDate: Date;
  careType: string;
  topic: string;
  advisorName: string;
};

type BehaviorAggRow = {
  id: string;
  observedAt: Date;
  category: string;
  severity: string;
  instructorName: string;
};

type AssessmentAggRow = {
  id: string;
  assessedAt: Date;
  score: number | null;
  instrument: string;
  riskLevel: RiskLevel;
};

const referralTargetLabel = (target: ReferralTarget): string => {
  switch (target) {
    case ReferralTarget.COUNSELING_CENTER:
      return "ศูนย์ให้คำปรึกษา / สุขภาพจิต";
    case ReferralTarget.STUDENT_DEVELOPMENT:
      return "พัฒนานักศึกษา";
    default:
      return target;
  }
};

const consultationStatusLabel = (status: ConsultationRequestStatus): string => {
  switch (status) {
    case ConsultationRequestStatus.PENDING:
      return "รอรับเรื่อง";
    case ConsultationRequestStatus.ACCEPTED:
      return "รับแล้ว";
    case ConsultationRequestStatus.SCHEDULED:
      return "นัดหมายแล้ว";
    case ConsultationRequestStatus.CANCEL_REQUESTED:
      return "นศขอยกเลิก";
    case ConsultationRequestStatus.CLOSED:
      return "ปิดแล้ว";
    case ConsultationRequestStatus.CANCELLED:
      return "ยกเลิก";
    default:
      return status;
  }
};

const referralStatusLabel = (status: ReferralStatus): string => {
  switch (status) {
    case ReferralStatus.PENDING:
      return "รอรับ";
    case ReferralStatus.ACCEPTED:
      return "รับแล้ว";
    case ReferralStatus.CLOSED:
      return "ปิดแล้ว";
    default:
      return status;
  }
};

const emergencyStatusLabel = (status: EmergencyCaseStatus): string => {
  switch (status) {
    case EmergencyCaseStatus.OPEN:
      return "เปิด";
    case EmergencyCaseStatus.IN_PROGRESS:
      return "กำลังดูแล";
    case EmergencyCaseStatus.RESOLVED:
      return "ปิดแล้ว";
    default:
      return status;
  }
};

/** รวมคำขอปรึกษาเป็นรายอาจารย์ — O(n) ด้วย Map */
export function aggregateConsultationsByTeacher(
  rows: ConsultationAggRow[]
): ExecutiveConsultationByTeacher[] {
  const byTeacher = new Map<string, ExecutiveConsultationByTeacher>();

  for (const row of rows) {
    const current = byTeacher.get(row.teacherId);
    const isOpen = OPEN_CONSULTATION_STATUSES.includes(row.status);
    if (!current) {
      byTeacher.set(row.teacherId, {
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        totalCount: 1,
        openCount: isOpen ? 1 : 0,
        closedCount: isOpen ? 0 : 1,
        lastRequestedAt: row.createdAt.toISOString(),
      });
      continue;
    }

    current.totalCount += 1;
    if (isOpen) {
      current.openCount += 1;
    } else {
      current.closedCount += 1;
    }
    if (row.createdAt.toISOString() > current.lastRequestedAt) {
      current.lastRequestedAt = row.createdAt.toISOString();
    }
  }

  return [...byTeacher.values()].sort((left, right) => {
    if (right.totalCount !== left.totalCount) {
      return right.totalCount - left.totalCount;
    }
    return right.lastRequestedAt.localeCompare(left.lastRequestedAt);
  });
}

/** สรุป referral เป็นตัวเลข + recent */
export function summarizeReferrals(rows: ReferralAggRow[]) {
  let open = 0;
  let closed = 0;
  let urgentOpen = 0;

  for (const row of rows) {
    const isOpen = OPEN_REFERRAL_STATUSES.includes(row.status);
    if (isOpen) {
      open += 1;
      if (row.isUrgent) {
        urgentOpen += 1;
      }
    } else {
      closed += 1;
    }
  }

  const recent = [...rows]
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      target: referralTargetLabel(row.target),
      status: referralStatusLabel(row.status),
      isUrgent: row.isUrgent,
      advisorName: row.advisorName,
      createdAt: row.createdAt.toISOString(),
    }));

  return { total: rows.length, open, closed, urgentOpen, recent };
}

/** สรุปเคสฉุกเฉิน/SOS */
export function summarizeEmergencies(rows: EmergencyAggRow[]) {
  let open = 0;
  let resolved = 0;

  for (const row of rows) {
    if (OPEN_EMERGENCY_STATUSES.includes(row.status)) {
      open += 1;
    } else {
      resolved += 1;
    }
  }

  const recent = [...rows]
    .sort((left, right) => right.openedAt.getTime() - left.openedAt.getTime())
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      status: emergencyStatusLabel(row.status),
      summary: (stripSeedMarkers(row.summary) || row.summary).slice(0, 160),
      openedAt: row.openedAt.toISOString(),
      resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    }));

  return { total: rows.length, open, resolved, recent };
}

/** รวมไทม์ไลน์กิจกรรมระดับปฏิบัติการ (ไม่รวมข้อความแชท / หมายเหตุเชิงคลินิกลึก) */
export function buildExecutiveActivityTimeline(input: {
  consultations: ConsultationAggRow[];
  referrals: ReferralAggRow[];
  cares: CareAggRow[];
  behaviors: BehaviorAggRow[];
  emergencies: EmergencyAggRow[];
  assessments: AssessmentAggRow[];
  limit?: number;
}): ExecutiveDossierActivityItem[] {
  const limit = input.limit ?? 24;
  const items: Array<ExecutiveDossierActivityItem & { sortAt: number }> = [
    ...input.consultations.map((row) => ({
      id: `consultation:${row.id}`,
      kind: "CONSULTATION" as const,
      date: row.createdAt.toISOString(),
      type: "คำขอปรึกษา",
      topic: stripSeedMarkers(row.topic) || row.topic,
      status: consultationStatusLabel(row.status),
      actorName: row.teacherName,
      isUrgent: false,
      sortAt: row.createdAt.getTime(),
    })),
    ...input.referrals.map((row) => ({
      id: `referral:${row.id}`,
      kind: "REFERRAL" as const,
      date: row.createdAt.toISOString(),
      type: "ส่งต่อเคส",
      topic: `ส่งต่อไปยัง ${referralTargetLabel(row.target)}`,
      status: referralStatusLabel(row.status),
      actorName: row.advisorName,
      isUrgent: row.isUrgent,
      sortAt: row.createdAt.getTime(),
    })),
    ...input.cares.map((row) => ({
      id: `care:${row.id}`,
      kind: "CARE" as const,
      date: row.careDate.toISOString(),
      type: "บันทึกการดูแล",
      topic: stripSeedMarkers(`${row.careType}: ${row.topic}`) || `${row.careType}: ${row.topic}`,
      status: null,
      actorName: row.advisorName,
      isUrgent: false,
      sortAt: row.careDate.getTime(),
    })),
    ...input.behaviors.map((row) => ({
      id: `behavior:${row.id}`,
      kind: "BEHAVIOR" as const,
      date: row.observedAt.toISOString(),
      type: "ข้อสังเกตจากผู้สอน",
      topic: row.category,
      status:
        row.severity === "HIGH"
          ? "ความเร่งด่วน: สูง"
          : row.severity === "MEDIUM"
            ? "ความเร่งด่วน: ปานกลาง"
            : "ความเร่งด่วน: ต่ำ",
      actorName: row.instructorName,
      isUrgent: row.severity === "HIGH",
      sortAt: row.observedAt.getTime(),
    })),
    ...input.emergencies.map((row) => ({
      id: `emergency:${row.id}`,
      kind: "EMERGENCY" as const,
      date: row.openedAt.toISOString(),
      type: "เคสฉุกเฉิน / SOS",
      topic: (stripSeedMarkers(row.summary) || row.summary).slice(0, 120),
      status: emergencyStatusLabel(row.status),
      actorName: "ระบบ",
      isUrgent: OPEN_EMERGENCY_STATUSES.includes(row.status),
      sortAt: row.openedAt.getTime(),
    })),
    ...input.assessments.map((row) => {
      const risk = normalizeRiskLevel(row.riskLevel);
      const riskLabel =
        risk === "high" ? "เสี่ยงสูง" : risk === "medium" ? "เสี่ยงปานกลาง" : "ปกติ";
      return {
        id: `assessment:${row.id}`,
        kind: "ASSESSMENT" as const,
        date: row.assessedAt.toISOString(),
        type: "ผลประเมิน",
        topic: `${row.instrument}${row.score === null ? "" : ` · คะแนน ${row.score}`}`,
        status: riskLabel,
        actorName: "ระบบ",
        isUrgent: risk === "high",
        sortAt: row.assessedAt.getTime(),
      };
    }),
  ];

  return items
    .sort((left, right) => right.sortAt - left.sortAt)
    .slice(0, limit)
    .map(({ sortAt: _sortAt, ...item }) => item);
}

/** โหลด dossier นิสิตสำหรับผู้บริหาร — รวมแนวโน้มปรึกษา/ส่งต่อ/SOS/ประเมิน */
export async function getExecutiveStudentDossier(
  db: PrismaClient,
  actorUserId: string,
  studentUserId: string
): Promise<"forbidden" | "not_found" | ExecutiveStudentDossierPayload> {
  const card = await getSensitiveStudentCard(db, Role.EXECUTIVE, actorUserId, studentUserId);
  if (card === "forbidden" || card === "not_found") {
    return card;
  }

  const allowed = await canAccessStudent(Role.EXECUTIVE, actorUserId, studentUserId);
  if (!allowed) {
    return "forbidden";
  }

  const [consultations, referrals, cares, behaviors, emergencies, surveyResponses, legacyAssessments] =
    await Promise.all([
      db.consultationRequest.findMany({
        where: { studentId: studentUserId },
        select: {
          id: true,
          topic: true,
          status: true,
          createdAt: true,
          teacherId: true,
          teacher: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      db.caseReferral.findMany({
        where: { studentId: studentUserId },
        select: {
          id: true,
          target: true,
          status: true,
          isUrgent: true,
          createdAt: true,
          advisor: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.careRecord.findMany({
        where: { studentId: studentUserId },
        select: {
          id: true,
          careDate: true,
          careType: true,
          topic: true,
          advisor: { select: { name: true } },
        },
        orderBy: { careDate: "desc" },
        take: 30,
      }),
      db.behaviorRecord.findMany({
        where: { studentId: studentUserId },
        select: {
          id: true,
          observedAt: true,
          category: true,
          severity: true,
          instructor: { select: { name: true } },
        },
        orderBy: { observedAt: "desc" },
        take: 30,
      }),
      db.emergencyCase.findMany({
        where: { studentId: studentUserId },
        select: {
          id: true,
          status: true,
          summary: true,
          openedAt: true,
          resolvedAt: true,
        },
        orderBy: { openedAt: "desc" },
        take: 30,
      }),
      db.surveyResponse.findMany({
        where: { studentId: studentUserId },
        select: {
          id: true,
          submittedAt: true,
          totalScore: true,
          instrument: true,
          riskLevel: true,
          survey: { select: { title: true } },
        },
        orderBy: { submittedAt: "desc" },
        take: 8,
      }),
      db.studentAssessment.findMany({
        where: { studentId: studentUserId },
        select: {
          id: true,
          assessedAt: true,
          totalScore: true,
          instrument: true,
          riskLevel: true,
        },
        orderBy: { assessedAt: "desc" },
        take: 8,
      }),
    ]);

  const consultationRows: ConsultationAggRow[] = consultations.map((row) => ({
    id: row.id,
    teacherId: row.teacherId,
    teacherName: row.teacher.name,
    topic: row.topic,
    status: row.status,
    createdAt: row.createdAt,
  }));

  const referralRows: ReferralAggRow[] = referrals.map((row) => ({
    id: row.id,
    target: row.target,
    status: row.status,
    isUrgent: row.isUrgent,
    advisorName: row.advisor.name,
    createdAt: row.createdAt,
  }));

  const emergencyRows: EmergencyAggRow[] = emergencies.map((row) => ({
    id: row.id,
    status: row.status,
    summary: row.summary,
    openedAt: row.openedAt,
    resolvedAt: row.resolvedAt,
  }));

  const careRows: CareAggRow[] = cares.map((row) => ({
    id: row.id,
    careDate: row.careDate,
    careType: row.careType,
    topic: row.topic,
    advisorName: row.advisor.name,
  }));

  const behaviorRows: BehaviorAggRow[] = behaviors.map((row) => ({
    id: row.id,
    observedAt: row.observedAt,
    category: row.category,
    severity: row.severity,
    instructorName: row.instructor.name,
  }));

  const assessmentRows: AssessmentAggRow[] = [
    ...surveyResponses.map((row) => ({
      id: row.id,
      assessedAt: row.submittedAt,
      score: row.totalScore,
      instrument: row.instrument || row.survey.title,
      riskLevel: row.riskLevel,
    })),
    ...legacyAssessments.map((row) => ({
      id: row.id,
      assessedAt: row.assessedAt,
      score: row.totalScore,
      instrument: row.instrument,
      riskLevel: row.riskLevel,
    })),
  ]
    .sort((left, right) => right.assessedAt.getTime() - left.assessedAt.getTime())
    .slice(0, 8);

  const consultationByTeacher = aggregateConsultationsByTeacher(consultationRows);

  return {
    student: card,
    consultationByTeacher,
    consultationTotal: consultationRows.length,
    referrals: summarizeReferrals(referralRows),
    emergencies: summarizeEmergencies(emergencyRows),
    assessments: assessmentRows.map((row) => ({
      assessedAt: row.assessedAt.toISOString(),
      score: row.score,
      instrument: row.instrument,
      riskLevel: normalizeRiskLevel(row.riskLevel),
    })),
    activity: buildExecutiveActivityTimeline({
      consultations: consultationRows,
      referrals: referralRows,
      cares: careRows,
      behaviors: behaviorRows,
      emergencies: emergencyRows,
      assessments: assessmentRows,
    }),
  };
}
