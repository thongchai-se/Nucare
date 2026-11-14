import {
  RiskLevel,
  SurveyInstrumentCode,
  type PrismaClient,
  type SurveyWaveStatus,
} from "@prisma/client";
import { prisma } from "./prisma";
import { deriveAssignmentStatus } from "./survey-wave-lifecycle";

export type AssessmentTimelineStatus = "COMPLETED" | "NOT_COMPLETED" | "OVERDUE";

export type StudentAssessmentTimelineEntry = {
  id: string;
  waveId: string;
  waveLabel: string;
  surveyId: string;
  surveyTitle: string;
  instrumentCode: SurveyInstrumentCode;
  instrument: string;
  status: AssessmentTimelineStatus;
  totalScore: number | null;
  maxScore: number | null;
  scorePercent: number | null;
  riskLevel: RiskLevel | null;
  submittedAt: string | null;
  scheduledAt: string;
  closesAt: string | null;
};

type TimelineSurvey = {
  id: string;
  title: string;
  instrumentCode: SurveyInstrumentCode;
};

export type AssessmentTimelineResponseFixture = {
  id: string;
  waveId: string;
  totalScore: number | null;
  maxScore: number;
  scorePercent: number | null;
  riskLevel: RiskLevel;
  instrument: string | null;
  submittedAt: Date;
  survey: TimelineSurvey;
  wave: {
    id: string;
    label: string;
    opensAt: Date;
    closesAt: Date | null;
  };
};

export type AssessmentTimelineAssignmentFixture = {
  id: string;
  waveId: string;
  completedAt: Date | null;
  wave: {
    id: string;
    label: string;
    opensAt: Date;
    closesAt: Date | null;
    status: SurveyWaveStatus;
    survey: TimelineSurvey;
  };
};

const matchesInstrumentFilter = (
  survey: TimelineSurvey,
  instrument: string | null,
  filter: string | undefined
): boolean => {
  if (!filter) {
    return true;
  }

  const normalized = filter.trim().toUpperCase();
  return (
    survey.instrumentCode === normalized ||
    survey.id === filter ||
    instrument?.trim().toUpperCase() === normalized
  );
};

/**
 * รวมผลตอบและ assignment ที่ยังไม่เสร็จเป็นไทม์ไลน์เดียว โดยใช้ Map กันข้อมูลคลื่นซ้ำ
 * รับแต่ละชุดที่เรียงเวลาแล้วและ merge ใน O(n+m) โดยไม่แตะฐานข้อมูล
 */
export function buildAssessmentTimelineEntries(input: {
  responses: AssessmentTimelineResponseFixture[];
  assignments: AssessmentTimelineAssignmentFixture[];
  instrumentCode?: string;
  now?: Date;
}): StudentAssessmentTimelineEntry[] {
  const now = input.now ?? new Date();
  const responseWaveIds = new Map<string, true>();
  const responseEntries: StudentAssessmentTimelineEntry[] = [];
  const assignmentEntries: StudentAssessmentTimelineEntry[] = [];

  for (const response of input.responses) {
    if (!matchesInstrumentFilter(response.survey, response.instrument, input.instrumentCode)) {
      continue;
    }
    responseWaveIds.set(response.waveId, true);
    responseEntries.push({
      id: `response:${response.id}`,
      waveId: response.waveId,
      waveLabel: response.wave.label,
      surveyId: response.survey.id,
      surveyTitle: response.survey.title,
      instrumentCode: response.survey.instrumentCode,
      instrument: response.instrument || response.survey.title,
      status: "COMPLETED",
      totalScore: response.totalScore,
      maxScore: response.maxScore,
      scorePercent: response.scorePercent,
      riskLevel: response.riskLevel,
      submittedAt: response.submittedAt.toISOString(),
      scheduledAt: response.wave.opensAt.toISOString(),
      closesAt: response.wave.closesAt?.toISOString() ?? null,
    });
  }

  for (const assignment of input.assignments) {
    if (
      responseWaveIds.has(assignment.waveId) ||
      !matchesInstrumentFilter(assignment.wave.survey, null, input.instrumentCode)
    ) {
      continue;
    }

    const assignmentStatus = deriveAssignmentStatus({
      completedAt: assignment.completedAt,
      closesAt: assignment.wave.closesAt,
      waveStatus: assignment.wave.status,
      now,
    });
    if (assignmentStatus === "completed") {
      continue;
    }

    assignmentEntries.push({
      id: `assignment:${assignment.id}`,
      waveId: assignment.waveId,
      waveLabel: assignment.wave.label,
      surveyId: assignment.wave.survey.id,
      surveyTitle: assignment.wave.survey.title,
      instrumentCode: assignment.wave.survey.instrumentCode,
      instrument: assignment.wave.survey.title,
      status: assignmentStatus === "overdue" ? "OVERDUE" : "NOT_COMPLETED",
      totalScore: null,
      maxScore: null,
      scorePercent: null,
      riskLevel: null,
      submittedAt: null,
      scheduledAt: assignment.wave.opensAt.toISOString(),
      closesAt: assignment.wave.closesAt?.toISOString() ?? null,
    });
  }

  const entries: StudentAssessmentTimelineEntry[] = [];
  let responseIndex = 0;
  let assignmentIndex = 0;
  while (
    responseIndex < responseEntries.length ||
    assignmentIndex < assignmentEntries.length
  ) {
    const response = responseEntries[responseIndex];
    const assignment = assignmentEntries[assignmentIndex];
    if (!assignment) {
      entries.push(response);
      responseIndex += 1;
      continue;
    }
    if (!response) {
      entries.push(assignment);
      assignmentIndex += 1;
      continue;
    }
    const responseTime = new Date(response.submittedAt ?? response.scheduledAt).getTime();
    const assignmentTime = new Date(assignment.scheduledAt).getTime();
    if (responseTime <= assignmentTime) {
      entries.push(response);
      responseIndex += 1;
    } else {
      entries.push(assignment);
      assignmentIndex += 1;
    }
  }

  return entries;
}

/**
 * โหลดผลประเมินและ assignment ของนิสิตตามช่วงเวลา แล้วคืนรายการเรียงจากเก่าไปใหม่
 * ตัวกรองรองรับรหัสเครื่องมือ รหัสแบบประเมิน หรือชื่อเครื่องมือที่บันทึกกับผลตอบ
 */
export async function buildStudentAssessmentTimeline(input: {
  studentId: string;
  instrumentCode?: string;
  from?: Date;
  to?: Date;
}, db: Pick<PrismaClient, "surveyResponse" | "surveyAssignment"> = prisma): Promise<StudentAssessmentTimelineEntry[]> {
  const responseDateRange = {
    ...(input.from ? { gte: input.from } : {}),
    ...(input.to ? { lte: input.to } : {}),
  };
  const waveDateRange = {
    ...(input.from ? { gte: input.from } : {}),
    ...(input.to ? { lte: input.to } : {}),
  };

  const [responses, assignments] = await Promise.all([
    db.surveyResponse.findMany({
      where: {
        studentId: input.studentId,
        ...(input.from || input.to ? { submittedAt: responseDateRange } : {}),
      },
      select: {
        id: true,
        waveId: true,
        totalScore: true,
        maxScore: true,
        scorePercent: true,
        riskLevel: true,
        instrument: true,
        submittedAt: true,
        survey: { select: { id: true, title: true, instrumentCode: true } },
        wave: {
          select: {
            id: true,
            label: true,
            opensAt: true,
            closesAt: true,
          },
        },
      },
      orderBy: { submittedAt: "asc" },
    }),
    db.surveyAssignment.findMany({
      where: {
        studentId: input.studentId,
        completedAt: null,
        ...(input.from || input.to ? { wave: { opensAt: waveDateRange } } : {}),
      },
      select: {
        id: true,
        waveId: true,
        completedAt: true,
        wave: {
          select: {
            id: true,
            label: true,
            opensAt: true,
            closesAt: true,
            status: true,
            survey: { select: { id: true, title: true, instrumentCode: true } },
          },
        },
      },
      orderBy: { wave: { opensAt: "asc" } },
    }),
  ]);

  return buildAssessmentTimelineEntries({
    responses,
    assignments,
    instrumentCode: input.instrumentCode,
  });
}
