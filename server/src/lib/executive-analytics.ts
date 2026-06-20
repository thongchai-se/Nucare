import {
  ConsultationRequestStatus,
  EmergencyCaseStatus,
  ReferralStatus,
  RiskLevel,
  Role,
  SurveyStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import {
  calculateSurveyMaxScore,
  calculateSurveyResponseScore,
  getGhq28DistressLevel,
  getGhq28RiskLevel,
  getSurveyInstrumentLabel,
  getSurveyRiskLevel,
  Ghq28DistressLevel,
  isGhq28SurveyTitle,
} from "./survey-scoring";
import { clampStudyYear } from "./study-year";

export type DistressCounts = {
  NORMAL: number;
  MILD: number;
  MODERATE: number;
  SEVERE: number;
  unscreened: number;
};

export type RiskCounts = {
  NORMAL: number;
  MEDIUM: number;
  HIGH: number;
  unscreened: number;
};

export type CommonIssueItem = {
  label: string;
  count: number;
  percent: number;
};

export type TrendItem = {
  month: string;
  label: string;
  screened: number;
  highRisk: number;
  referrals: number;
  sos: number;
};

export type SectionStat = {
  section: string;
  totalStudents: number;
  screenedPercent: number;
  highRiskPercent: number;
};

export type StudyYearBucket = {
  studyYear: number | null;
  label: string;
  totalStudents: number;
  screenedCount: number;
  screenedPercent: number;
  distressCounts: DistressCounts;
  riskCounts: RiskCounts;
  highRiskPercent: number;
  avgGhq28Score: number | null;
  commonIssues: CommonIssueItem[];
  trends: TrendItem[];
  sections: SectionStat[];
};

export type ExecutiveOperationsStats = {
  avgConsultationResponseHours: number | null;
  caseClosureRate: number | null;
  openReferrals: number;
  openSos: number;
};

export type ExecutiveDashboardPayload = {
  generatedAt: string;
  activeSurvey: { id: string; title: string } | null;
  overall: StudyYearBucket;
  byStudyYear: StudyYearBucket[];
  operations: ExecutiveOperationsStats;
};

export type StudentScreeningProfile = {
  id: string;
  studyYear: number | null;
  section: string | null;
  isScreened: boolean;
  riskLevel: RiskLevel | null;
  distressLevel: Ghq28DistressLevel | null;
  ghq28Score: number | null;
  screenedAt: Date | null;
};

type ConsultationRecord = {
  topic: string;
  createdAt: Date;
  studentStudyYear: number | null;
};

type ReferralRecord = {
  createdAt: Date;
  status: ReferralStatus;
  studentStudyYear: number | null;
};

type EmergencyRecord = {
  openedAt: Date;
  status: EmergencyCaseStatus;
  studentStudyYear: number | null;
};

type ScreeningEvent = {
  at: Date;
  studentId: string;
  studentStudyYear: number | null;
  riskLevel: RiskLevel;
};

const EXECUTIVE_STUDENT_MAX_RESULTS = 5000;
const TREND_MONTH_COUNT = 6;

const COMMON_ISSUE_LABELS = [
  "ปัญหาการเรียน / ฝึกปฏิบัติ",
  "ความสัมพันธ์และครอบครัว",
  "ปัญหาการเงิน",
  "ปัญหาสุขภาพจิต",
  "อื่นๆ",
] as const;

const CONSULTATION_TOPIC_MAP: Record<string, (typeof COMMON_ISSUE_LABELS)[number]> = {
  "การเรียนและผลการเรียน": "ปัญหาการเรียน / ฝึกปฏิบัติ",
  "การฝึกปฏิบัติ/ขึ้นวอร์ด": "ปัญหาการเรียน / ฝึกปฏิบัติ",
  "ความสัมพันธ์และครอบครัว": "ความสัมพันธ์และครอบครัว",
  "ทุนการศึกษาและค่าใช้จ่าย": "ปัญหาการเงิน",
  "สุขภาพใจและความเครียด": "ปัญหาสุขภาพจิต",
  "การปรับตัวในมหาวิทยาลัย": "อื่นๆ",
  "อื่น ๆ": "อื่นๆ",
};

export const getStudyYearLabel = (studyYear: number | null): string => {
  if (studyYear === null || !Number.isFinite(studyYear) || studyYear < 1) {
    return "ไม่ระบุ";
  }

  return `ชั้นปีที่ ${clampStudyYear(studyYear)}`;
};

export const normalizeStudyYearKey = (studyYear: number | null): number | null => {
  if (studyYear === null || !Number.isFinite(studyYear) || studyYear < 1) {
    return null;
  }

  return clampStudyYear(studyYear);
};

export const mapConsultationTopicToIssueLabel = (topic: string): (typeof COMMON_ISSUE_LABELS)[number] =>
  CONSULTATION_TOPIC_MAP[topic.trim()] ?? "อื่นๆ";

export const createEmptyDistressCounts = (): DistressCounts => ({
  NORMAL: 0,
  MILD: 0,
  MODERATE: 0,
  SEVERE: 0,
  unscreened: 0,
});

export const createEmptyRiskCounts = (): RiskCounts => ({
  NORMAL: 0,
  MEDIUM: 0,
  HIGH: 0,
  unscreened: 0,
});

export const mergeStudentScreeningProfile = (input: {
  id: string;
  studyYear: number | null;
  section: string | null;
  surveyResult?: {
    totalScore: number | null;
    riskLevel: RiskLevel;
    submittedAt: Date;
    isGhq28: boolean;
  } | null;
  latestAssessment?: {
    riskLevel: RiskLevel;
    assessedAt: Date;
  } | null;
}): StudentScreeningProfile => {
  const { surveyResult, latestAssessment } = input;

  if (surveyResult) {
    const distress = surveyResult.isGhq28
      ? getGhq28DistressLevel(surveyResult.totalScore)?.level ?? null
      : null;

    return {
      id: input.id,
      studyYear: input.studyYear,
      section: input.section,
      isScreened: true,
      riskLevel: surveyResult.riskLevel,
      distressLevel: distress,
      ghq28Score: surveyResult.isGhq28 ? surveyResult.totalScore : null,
      screenedAt: surveyResult.submittedAt,
    };
  }

  if (latestAssessment) {
    return {
      id: input.id,
      studyYear: input.studyYear,
      section: input.section,
      isScreened: true,
      riskLevel: latestAssessment.riskLevel,
      distressLevel: null,
      ghq28Score: null,
      screenedAt: latestAssessment.assessedAt,
    };
  }

  return {
    id: input.id,
    studyYear: input.studyYear,
    section: input.section,
    isScreened: false,
    riskLevel: null,
    distressLevel: null,
    ghq28Score: null,
    screenedAt: null,
  };
};

export const aggregateCommonIssues = (topics: string[]): CommonIssueItem[] => {
  const counts = new Map<string, number>();
  COMMON_ISSUE_LABELS.forEach((label) => counts.set(label, 0));

  topics.forEach((topic) => {
    const label = mapConsultationTopicToIssueLabel(topic);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const total = topics.length;
  return COMMON_ISSUE_LABELS.map((label) => {
    const count = counts.get(label) ?? 0;
    return {
      label,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  }).filter((item) => item.count > 0 || total === 0);
};

const matchesStudyYearFilter = (
  studyYear: number | null,
  filterStudyYear: number | null | "ALL"
): boolean => {
  if (filterStudyYear === "ALL") {
    return true;
  }

  return normalizeStudyYearKey(studyYear) === filterStudyYear;
};

export const buildTrendMonths = (now: Date = new Date()): { month: string; label: string }[] => {
  const months: { month: string; label: string }[] = [];

  for (let offset = TREND_MONTH_COUNT - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = new Intl.DateTimeFormat("th-TH", { month: "short" }).format(date);
    months.push({ month, label });
  }

  return months;
};

const isSameMonth = (value: Date, monthKey: string): boolean => {
  const month = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
  return month === monthKey;
};

export const buildTrendItems = (input: {
  screeningEvents: ScreeningEvent[];
  referrals: ReferralRecord[];
  emergencies: EmergencyRecord[];
  filterStudyYear?: number | null | "ALL";
  now?: Date;
}): TrendItem[] => {
  const now = input.now ?? new Date();
  const filterStudyYear = input.filterStudyYear ?? "ALL";

  return buildTrendMonths(now).map(({ month, label }) => {
    const screened = input.screeningEvents.filter(
      (event) =>
        isSameMonth(event.at, month) &&
        matchesStudyYearFilter(event.studentStudyYear, filterStudyYear)
    ).length;

    const highRisk = input.screeningEvents.filter(
      (event) =>
        event.riskLevel === RiskLevel.HIGH &&
        isSameMonth(event.at, month) &&
        matchesStudyYearFilter(event.studentStudyYear, filterStudyYear)
    ).length;

    const referrals = input.referrals.filter(
      (referral) =>
        isSameMonth(referral.createdAt, month) &&
        matchesStudyYearFilter(referral.studentStudyYear, filterStudyYear)
    ).length;

    const sos = input.emergencies.filter(
      (emergency) =>
        isSameMonth(emergency.openedAt, month) &&
        matchesStudyYearFilter(emergency.studentStudyYear, filterStudyYear)
    ).length;

    return { month, label, screened, highRisk, referrals, sos };
  });
};

export const buildSectionStats = (
  profiles: StudentScreeningProfile[],
  filterStudyYear: number | null | "ALL" = "ALL"
): SectionStat[] => {
  const filtered = profiles.filter((profile) =>
    matchesStudyYearFilter(profile.studyYear, filterStudyYear)
  );

  const sectionMap = new Map<string, StudentScreeningProfile[]>();
  filtered.forEach((profile) => {
    const section = profile.section?.trim() || "ไม่ระบุ";
    const bucket = sectionMap.get(section) ?? [];
    bucket.push(profile);
    sectionMap.set(section, bucket);
  });

  return [...sectionMap.entries()]
    .map(([section, students]) => {
      const screened = students.filter((student) => student.isScreened);
      const highRisk = screened.filter((student) => student.riskLevel === RiskLevel.HIGH);

      return {
        section,
        totalStudents: students.length,
        screenedPercent:
          students.length === 0 ? 0 : Math.round((screened.length / students.length) * 100),
        highRiskPercent:
          students.length === 0 ? 0 : Math.round((highRisk.length / students.length) * 100),
      };
    })
    .sort((left, right) => right.totalStudents - left.totalStudents);
};

export const buildStudyYearBucket = (input: {
  studyYear: number | null;
  filterStudyYear: number | null | "ALL";
  profiles: StudentScreeningProfile[];
  consultations: ConsultationRecord[];
  referrals: ReferralRecord[];
  emergencies: EmergencyRecord[];
  screeningEvents: ScreeningEvent[];
  now?: Date;
}): StudyYearBucket => {
  const { filterStudyYear } = input;

  const profiles = input.profiles.filter((profile) =>
    matchesStudyYearFilter(profile.studyYear, filterStudyYear)
  );

  const distressCounts = createEmptyDistressCounts();
  const riskCounts = createEmptyRiskCounts();
  let ghq28ScoreTotal = 0;
  let ghq28ScoreCount = 0;

  profiles.forEach((profile) => {
    if (!profile.isScreened) {
      distressCounts.unscreened += 1;
      riskCounts.unscreened += 1;
      return;
    }

    if (profile.distressLevel) {
      distressCounts[profile.distressLevel] += 1;
    } else {
      distressCounts.unscreened += 1;
    }

    if (profile.riskLevel) {
      riskCounts[profile.riskLevel] += 1;
    } else {
      riskCounts.unscreened += 1;
    }

    if (typeof profile.ghq28Score === "number" && Number.isFinite(profile.ghq28Score)) {
      ghq28ScoreTotal += profile.ghq28Score;
      ghq28ScoreCount += 1;
    }
  });

  const screenedCount = profiles.filter((profile) => profile.isScreened).length;
  const highRiskCount = profiles.filter((profile) => profile.riskLevel === RiskLevel.HIGH).length;

  const consultationTopics = input.consultations
    .filter((consultation) => matchesStudyYearFilter(consultation.studentStudyYear, filterStudyYear))
    .map((consultation) => consultation.topic);

  return {
    studyYear: input.studyYear,
    label: filterStudyYear === "ALL" ? "ภาพรวมทั้งคณะ" : getStudyYearLabel(input.studyYear),
    totalStudents: profiles.length,
    screenedCount,
    screenedPercent:
      profiles.length === 0 ? 0 : Math.round((screenedCount / profiles.length) * 100),
    distressCounts,
    riskCounts,
    highRiskPercent:
      profiles.length === 0 ? 0 : Math.round((highRiskCount / profiles.length) * 100),
    avgGhq28Score: ghq28ScoreCount === 0 ? null : Math.round(ghq28ScoreTotal / ghq28ScoreCount),
    commonIssues: aggregateCommonIssues(consultationTopics),
    trends: buildTrendItems({
      screeningEvents: input.screeningEvents,
      referrals: input.referrals,
      emergencies: input.emergencies,
      filterStudyYear,
      now: input.now,
    }),
    sections: buildSectionStats(input.profiles, filterStudyYear),
  };
};

export const buildStudyYearBuckets = (input: {
  profiles: StudentScreeningProfile[];
  consultations: ConsultationRecord[];
  referrals: ReferralRecord[];
  emergencies: EmergencyRecord[];
  screeningEvents: ScreeningEvent[];
  now?: Date;
}): { overall: StudyYearBucket; byStudyYear: StudyYearBucket[] } => {
  const studyYears = new Set<number | null>();
  input.profiles.forEach((profile) => {
    studyYears.add(normalizeStudyYearKey(profile.studyYear));
  });

  const orderedYears = [...studyYears].sort((left, right) => {
    if (left === null) {
      return 1;
    }

    if (right === null) {
      return -1;
    }

    return left - right;
  });

  const byStudyYear = orderedYears.map((studyYear) =>
    buildStudyYearBucket({
      studyYear,
      filterStudyYear: studyYear,
      profiles: input.profiles,
      consultations: input.consultations,
      referrals: input.referrals,
      emergencies: input.emergencies,
      screeningEvents: input.screeningEvents,
      now: input.now,
    })
  );

  const overall = buildStudyYearBucket({
    studyYear: null,
    filterStudyYear: "ALL",
    profiles: input.profiles,
    consultations: input.consultations,
    referrals: input.referrals,
    emergencies: input.emergencies,
    screeningEvents: input.screeningEvents,
    now: input.now,
  });

  return { overall, byStudyYear };
};

export const buildOperationsStats = (input: {
  consultations: Array<{ status: ConsultationRequestStatus; createdAt: Date; acceptedAt: Date | null }>;
  referrals: Array<{ status: ReferralStatus }>;
  emergencies: Array<{ status: EmergencyCaseStatus }>;
}): ExecutiveOperationsStats => {
  const acceptedConsultations = input.consultations.filter(
    (consultation) => consultation.acceptedAt !== null
  );

  const responseHours = acceptedConsultations
    .map((consultation) => {
      if (!consultation.acceptedAt) {
        return null;
      }

      const diffMs = consultation.acceptedAt.getTime() - consultation.createdAt.getTime();
      return diffMs >= 0 ? diffMs / (1000 * 60 * 60) : null;
    })
    .filter((value): value is number => value !== null);

  const avgConsultationResponseHours =
    responseHours.length === 0
      ? null
      : Math.round((responseHours.reduce((sum, value) => sum + value, 0) / responseHours.length) * 10) /
        10;

  const closedReferrals = input.referrals.filter(
    (referral) => referral.status === ReferralStatus.CLOSED
  ).length;
  const closedConsultations = input.consultations.filter(
    (consultation) => consultation.status === ConsultationRequestStatus.CLOSED
  ).length;
  const resolvedEmergencies = input.emergencies.filter(
    (emergency) => emergency.status === EmergencyCaseStatus.RESOLVED
  ).length;

  const totalCases = input.referrals.length + input.consultations.length + input.emergencies.length;
  const closedCases = closedReferrals + closedConsultations + resolvedEmergencies;

  return {
    avgConsultationResponseHours,
    caseClosureRate: totalCases === 0 ? null : Math.round((closedCases / totalCases) * 100),
    openReferrals: input.referrals.filter((referral) => referral.status !== ReferralStatus.CLOSED)
      .length,
    openSos: input.emergencies.filter((emergency) => emergency.status !== EmergencyCaseStatus.RESOLVED)
      .length,
  };
};

export const buildExecutiveDashboardStats = async (): Promise<ExecutiveDashboardPayload> => {
  const now = new Date();

  const [students, activeSurvey, consultations, referrals, emergencies, assessments] =
    await Promise.all([
      prisma.user.findMany({
        where: {
          role: Role.STUDENT,
          isActive: true,
        },
        select: {
          id: true,
          studyYear: true,
          section: true,
        },
        orderBy: [{ studyYear: "asc" }, { createdAt: "asc" }],
        take: EXECUTIVE_STUDENT_MAX_RESULTS,
      }),
      prisma.survey.findFirst({
        where: {
          status: SurveyStatus.PUBLISHED,
          isActive: true,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
        },
        orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
        include: {
          questions: {
            orderBy: { order: "asc" },
          },
          responses: {
            include: {
              answers: true,
            },
          },
        },
      }),
      prisma.consultationRequest.findMany({
        select: {
          topic: true,
          createdAt: true,
          acceptedAt: true,
          status: true,
          student: {
            select: {
              studyYear: true,
            },
          },
        },
      }),
      prisma.caseReferral.findMany({
        select: {
          createdAt: true,
          status: true,
          student: {
            select: {
              studyYear: true,
            },
          },
        },
      }),
      prisma.emergencyCase.findMany({
        select: {
          openedAt: true,
          status: true,
          student: {
            select: {
              studyYear: true,
            },
          },
        },
      }),
      prisma.studentAssessment.findMany({
        orderBy: [{ assessedAt: "desc" }, { createdAt: "desc" }],
        select: {
          studentId: true,
          riskLevel: true,
          assessedAt: true,
        },
      }),
    ]);

  const latestAssessmentByStudentId = new Map<
    string,
    { riskLevel: RiskLevel; assessedAt: Date }
  >();
  assessments.forEach((assessment) => {
    if (!latestAssessmentByStudentId.has(assessment.studentId)) {
      latestAssessmentByStudentId.set(assessment.studentId, {
        riskLevel: assessment.riskLevel,
        assessedAt: assessment.assessedAt,
      });
    }
  });

  const surveyResponseByStudentId = new Map<
    string,
    {
      totalScore: number | null;
      riskLevel: RiskLevel;
      submittedAt: Date;
      isGhq28: boolean;
    }
  >();

  if (activeSurvey) {
    const maxScore = calculateSurveyMaxScore(activeSurvey.questions, activeSurvey.title);
    const isGhq28 = isGhq28SurveyTitle(activeSurvey.title);

    activeSurvey.responses.forEach((response) => {
      if (surveyResponseByStudentId.has(response.studentId)) {
        return;
      }

      const responseMaxScore = response.maxScore > 0 ? response.maxScore : maxScore;
      const totalScore =
        response.totalScore ??
        calculateSurveyResponseScore(activeSurvey.questions, response.answers, activeSurvey.title);
      const computedRiskLevel = isGhq28
        ? getGhq28RiskLevel(totalScore)
        : getSurveyRiskLevel(activeSurvey.title, totalScore, responseMaxScore);

      surveyResponseByStudentId.set(response.studentId, {
        totalScore,
        riskLevel:
          response.totalScore === null || response.maxScore <= 0
            ? computedRiskLevel
            : response.riskLevel,
        submittedAt: response.submittedAt,
        isGhq28,
      });
    });
  }

  const profiles = students.map((student) =>
    mergeStudentScreeningProfile({
      id: student.id,
      studyYear: student.studyYear,
      section: student.section,
      surveyResult: surveyResponseByStudentId.get(student.id) ?? null,
      latestAssessment: latestAssessmentByStudentId.get(student.id) ?? null,
    })
  );

  const studentStudyYearById = new Map(
    students.map((student) => [student.id, normalizeStudyYearKey(student.studyYear)])
  );

  const screeningEvents: ScreeningEvent[] = [];

  surveyResponseByStudentId.forEach((response, studentId) => {
    screeningEvents.push({
      at: response.submittedAt,
      studentId,
      studentStudyYear: studentStudyYearById.get(studentId) ?? null,
      riskLevel: response.riskLevel,
    });
  });

  latestAssessmentByStudentId.forEach((assessment, studentId) => {
    if (surveyResponseByStudentId.has(studentId)) {
      return;
    }

    screeningEvents.push({
      at: assessment.assessedAt,
      studentId,
      studentStudyYear: studentStudyYearById.get(studentId) ?? null,
      riskLevel: assessment.riskLevel,
    });
  });

  const consultationRecords: ConsultationRecord[] = consultations.map((consultation) => ({
    topic: consultation.topic,
    createdAt: consultation.createdAt,
    studentStudyYear: normalizeStudyYearKey(consultation.student.studyYear),
  }));

  const referralRecords: ReferralRecord[] = referrals.map((referral) => ({
    createdAt: referral.createdAt,
    status: referral.status,
    studentStudyYear: normalizeStudyYearKey(referral.student.studyYear),
  }));

  const emergencyRecords: EmergencyRecord[] = emergencies.map((emergency) => ({
    openedAt: emergency.openedAt,
    status: emergency.status,
    studentStudyYear: normalizeStudyYearKey(emergency.student.studyYear),
  }));

  const { overall, byStudyYear } = buildStudyYearBuckets({
    profiles,
    consultations: consultationRecords,
    referrals: referralRecords,
    emergencies: emergencyRecords,
    screeningEvents,
    now,
  });

  const operations = buildOperationsStats({
    consultations,
    referrals,
    emergencies,
  });

  return {
    generatedAt: now.toISOString(),
    activeSurvey: activeSurvey
      ? {
          id: activeSurvey.id,
          title: activeSurvey.title,
        }
      : null,
    overall,
    byStudyYear,
    operations,
  };
};
