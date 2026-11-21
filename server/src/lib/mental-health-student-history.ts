import {
  EmergencyCaseStatus,
  MentalHealthAppointmentStatus,
  ReferralStatus,
  ReferralTarget,
  Role,
  type PrismaClient,
} from "@prisma/client";
import { stripSeedMarkers } from "./history-display";
import {
  aggregateConsultationsByTeacher,
  buildExecutiveActivityTimeline,
  summarizeEmergencies,
  summarizeReferrals,
  type ExecutiveConsultationByTeacher,
  type ExecutiveDossierActivityItem,
} from "./executive-student-dossier";
import {
  resolveMentalHealthStudentAccess,
  type MentalHealthAccessLevel,
} from "./mental-health-access";
import { serializeMentalHealthAppointment } from "./mental-health-appointments";
import {
  getSensitiveStudentCard,
  loadSensitiveStudentCardById,
  type SensitiveStudentCard,
} from "./sensitive-student-detail";
import { normalizeRiskLevel } from "./user-format";
import {
  buildStudentAssessmentTimeline,
  type StudentAssessmentTimelineEntry,
} from "./survey-assessment-history";

export type MentalHealthCareSessionHistory = {
  id: string;
  sessionDate: string;
  summary: string;
  interventionPlan: string;
  confidentialNotes: string | null;
  providerName: string;
  referralId: string | null;
  createdAt: string;
};

export type MentalHealthAppointmentHistoryItem = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  time: string;
  location: string;
  note: string;
  status: MentalHealthAppointmentStatus;
  providerName: string;
  scheduledAt: string;
  referralId: string | null;
};

export type MentalHealthHistoryActivityItem = ExecutiveDossierActivityItem & {
  detail?: string | null;
};

export type MentalHealthStudentHistoryPayload = {
  student: SensitiveStudentCard;
  careSessions: MentalHealthCareSessionHistory[];
  appointments: MentalHealthAppointmentHistoryItem[];
  consultationByTeacher: ExecutiveConsultationByTeacher[];
  consultationTotal: number;
  referrals: ReturnType<typeof summarizeReferrals>;
  emergencies: ReturnType<typeof summarizeEmergencies>;
  assessments: Array<{
    assessedAt: string;
    score: number | null;
    instrument: string;
    riskLevel: ReturnType<typeof normalizeRiskLevel>;
  }>;
  assessmentTimeline: StudentAssessmentTimelineEntry[];
  activity: MentalHealthHistoryActivityItem[];
};

const appointmentStatusLabel = (status: MentalHealthAppointmentStatus): string => {
  switch (status) {
    case MentalHealthAppointmentStatus.SCHEDULED:
      return "นัดหมายแล้ว";
    case MentalHealthAppointmentStatus.COMPLETED:
      return "พบแล้ว";
    case MentalHealthAppointmentStatus.CANCELLED:
      return "ยกเลิก";
    case MentalHealthAppointmentStatus.NO_SHOW:
      return "ไม่มาตามนัด";
    default:
      return status;
  }
};

/** รวมไทม์ไลน์ผู้เชี่ยวชาญ: นัด + บันทึกเชิงลึกทับบน activity ทั่วไป */
export function mergeMentalHealthHistoryActivity(input: {
  baseActivity: ExecutiveDossierActivityItem[];
  careSessions: MentalHealthCareSessionHistory[];
  appointments: MentalHealthAppointmentHistoryItem[];
  limit?: number;
}): MentalHealthHistoryActivityItem[] {
  const limit = input.limit ?? 40;
  const specialized: MentalHealthHistoryActivityItem[] = input.careSessions.map((session) => {
    const summary = stripSeedMarkers(session.summary) || session.summary;
    const plan = stripSeedMarkers(session.interventionPlan) || session.interventionPlan;
    return {
      id: `specialized:${session.id}`,
      kind: "CARE" as const,
      date: session.sessionDate,
      type: "บันทึกผลการปรึกษา (ผู้เชี่ยวชาญ)",
      topic: summary.slice(0, 160),
      status: null,
      actorName: session.providerName,
      isUrgent: false,
      detail: plan.slice(0, 200),
    };
  });

  const appointments: MentalHealthHistoryActivityItem[] = input.appointments.map((row) => {
    const note = stripSeedMarkers(row.note);
    return {
      id: `mh-appointment:${row.id}`,
      kind: "CONSULTATION" as const,
      date: row.scheduledAt,
      type: "นัดหมายสุขภาพจิต",
      topic: `${row.location}${note ? ` · ${note}` : ""}`,
      status: appointmentStatusLabel(row.status),
      actorName: row.providerName,
      isUrgent: false,
      detail: null,
    };
  });

  return [...specialized, ...appointments, ...input.baseActivity]
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
    .slice(0, limit);
}

type MentalHealthHistoryOptions = {
  /** บังคับระดับสิทธิ์เมื่อโหลดผ่าน referral ที่ตรวจแล้ว */
  accessLevel?: MentalHealthAccessLevel;
};

/** คิว triage / เคส clinical ได้ดูประวัติคัดกรอง — none ไม่ได้ */
export function includesScreeningHistory(accessLevel: MentalHealthAccessLevel): boolean {
  return accessLevel === "triage" || accessLevel === "clinical";
}

/** เนื้อหาบันทึกผู้เชี่ยวชาญ (summary/plan/บันทึกลับ) เฉพาะเจ้าของเคส */
export function includesClinicalCareContent(accessLevel: MentalHealthAccessLevel): boolean {
  return accessLevel === "clinical";
}

/**
 * การ์ดนิสิตตอนคิว triage — เปิดคะแนน/ความเสี่ยงให้ตัดสินใจรับเคส
 * แต่ยังไม่เปิดช่องทางติดต่อจนกว่าจะรับเคส
 */
export function shapeTriageStudentCard(card: SensitiveStudentCard): SensitiveStudentCard {
  return {
    ...card,
    phone: null,
    guardianPhone: null,
    email: null,
  };
}

/** โหลดประวัติจาก referral ของศูนย์ให้คำปรึกษา — คิวยังไม่รับ = triage, รับเอง = clinical */
export async function getMentalHealthStudentHistoryByReferral(
  db: PrismaClient,
  actorUserId: string,
  referralId: string
): Promise<"forbidden" | "not_found" | MentalHealthStudentHistoryPayload> {
  const referral = await db.caseReferral.findFirst({
    where: {
      id: referralId,
      target: ReferralTarget.COUNSELING_CENTER,
    },
    select: {
      id: true,
      studentId: true,
      status: true,
      acceptedByUserId: true,
      declines: {
        where: { userId: actorUserId },
        select: { userId: true },
        take: 1,
      },
    },
  });

  if (!referral) {
    return "not_found";
  }

  let accessLevel: MentalHealthAccessLevel = "none";
  if (
    referral.status === ReferralStatus.ACCEPTED &&
    referral.acceptedByUserId === actorUserId
  ) {
    accessLevel = "clinical";
  } else if (
    referral.status === ReferralStatus.PENDING &&
    referral.declines.length === 0
  ) {
    accessLevel = "triage";
  }

  if (accessLevel === "none") {
    return "forbidden";
  }

  return getMentalHealthStudentHistory(db, actorUserId, referral.studentId, {
    accessLevel,
  });
}

/** โหลดประวัตินิสิตครบสำหรับผู้เชี่ยวชาญ — รวมบันทึกเชิงลึก นัด และบริบทจากที่ปรึกษา */
export async function getMentalHealthStudentHistory(
  db: PrismaClient,
  actorUserId: string,
  studentUserId: string,
  options: MentalHealthHistoryOptions = {}
): Promise<"forbidden" | "not_found" | MentalHealthStudentHistoryPayload> {
  const accessLevel =
    options.accessLevel ??
    (await resolveMentalHealthStudentAccess(db, actorUserId, studentUserId));
  if (accessLevel === "none") {
    return "forbidden";
  }

  // ถ้า accessLevel มาจาก referral ที่ตรวจแล้ว — โหลดการ์ดตรง ๆ ไม่ซ้ำ canAccessStudent
  const card = options.accessLevel
    ? await loadSensitiveStudentCardById(db, studentUserId)
    : await getSensitiveStudentCard(db, Role.MENTAL_HEALTH, actorUserId, studentUserId);
  if (card === "forbidden" || card === "not_found") {
    return card;
  }

  const [
    specializedCare,
    appointments,
    consultations,
    referrals,
    cares,
    behaviors,
    emergencies,
    surveyResponses,
    legacyAssessments,
    assessmentTimeline,
  ] = await Promise.all([
    includesClinicalCareContent(accessLevel)
      ? db.specializedCareRecord.findMany({
          where: { studentId: studentUserId },
          select: {
            id: true,
            sessionDate: true,
            summary: true,
            interventionPlan: true,
            confidentialNotes: true,
            referralId: true,
            createdAt: true,
            mentalHealthUser: { select: { name: true } },
          },
          orderBy: [{ sessionDate: "desc" }, { createdAt: "desc" }],
          take: 40,
        })
      : Promise.resolve([]),
    // คิว triage ก็เห็นนัดของนิสิตได้ (ตัด note) เพื่อประกอบการรับเคส
    db.mentalHealthAppointment.findMany({
      where: { studentId: studentUserId },
      select: {
        id: true,
        studentId: true,
        scheduledAt: true,
        location: true,
        note: true,
        status: true,
        referralId: true,
        student: { select: { name: true } },
        mentalHealthUser: { select: { name: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 40,
    }),
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
    buildStudentAssessmentTimeline({ studentId: studentUserId }, db),
  ]);

  const careSessions: MentalHealthCareSessionHistory[] = includesClinicalCareContent(accessLevel)
    ? specializedCare.map((row) => {
        const notes = row.confidentialNotes ?? null;
        return {
          id: row.id,
          sessionDate: row.sessionDate.toISOString(),
          summary: stripSeedMarkers(row.summary) || row.summary,
          interventionPlan: stripSeedMarkers(row.interventionPlan) || row.interventionPlan,
          confidentialNotes: notes ? stripSeedMarkers(notes) || notes : null,
          providerName: row.mentalHealthUser.name,
          referralId: row.referralId,
          createdAt: row.createdAt.toISOString(),
        };
      })
    : [];

  const appointmentItems: MentalHealthAppointmentHistoryItem[] = appointments.map((row) => {
    const dto = serializeMentalHealthAppointment(row);
    return {
      ...dto,
      note: includesClinicalCareContent(accessLevel) ? dto.note : "",
      status: row.status,
      providerName: dto.providerName,
      referralId: row.referralId,
    };
  });

  const consultationRows = consultations.map((row) => ({
    id: row.id,
    teacherId: row.teacherId,
    teacherName: row.teacher.name,
    topic: row.topic,
    status: row.status,
    createdAt: row.createdAt,
  }));

  const referralRows = referrals.map((row) => ({
    id: row.id,
    target: row.target as ReferralTarget,
    status: row.status as ReferralStatus,
    isUrgent: row.isUrgent,
    advisorName: row.advisor.name,
    createdAt: row.createdAt,
  }));

  const emergencyRows = emergencies.map((row) => ({
    id: row.id,
    status: row.status as EmergencyCaseStatus,
    summary: includesClinicalCareContent(accessLevel) ? row.summary : "",
    openedAt: row.openedAt,
    resolvedAt: row.resolvedAt,
  }));

  const careRows = cares.map((row) => ({
    id: row.id,
    careDate: row.careDate,
    careType: row.careType,
    topic: row.topic,
    advisorName: row.advisor.name,
  }));

  const behaviorRows = behaviors.map((row) => ({
    id: row.id,
    observedAt: row.observedAt,
    category: row.category,
    severity: row.severity,
    instructorName: row.instructor.name,
  }));

  const assessmentRows = includesScreeningHistory(accessLevel)
    ? [
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
        .slice(0, 8)
    : [];

  const triageStudent = accessLevel === "triage" ? shapeTriageStudentCard(card) : card;

  const baseActivity = buildExecutiveActivityTimeline({
    consultations: consultationRows,
    referrals: referralRows,
    cares: careRows,
    behaviors: behaviorRows,
    emergencies: emergencyRows,
    assessments: assessmentRows,
    limit: 30,
  });

  return {
    student: triageStudent,
    careSessions,
    appointments: appointmentItems,
    consultationByTeacher: aggregateConsultationsByTeacher(consultationRows),
    consultationTotal: consultationRows.length,
    referrals: summarizeReferrals(referralRows),
    emergencies: summarizeEmergencies(emergencyRows),
    assessments: assessmentRows.map((row) => ({
      assessedAt: row.assessedAt.toISOString(),
      score: row.score,
      instrument: row.instrument,
      riskLevel: normalizeRiskLevel(row.riskLevel),
    })),
    assessmentTimeline: includesScreeningHistory(accessLevel) ? assessmentTimeline : [],
    activity: mergeMentalHealthHistoryActivity({
      baseActivity,
      careSessions,
      appointments: appointmentItems,
    }),
  };
}
