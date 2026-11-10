import {
  AlertPriority,
  AlertType,
  Prisma,
  RiskLevel,
  Role,
  SurveyAudienceType,
  SurveyFrequency,
  SurveyInstrumentCode,
  SurveyStatus,
  SurveyWaveStatus,
  WellnessTrendSignalCode,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { notifyUser } from "../lib/notify-user";
import { prisma } from "../lib/prisma";
import { hasAssignedRole } from "../lib/roles";
import {
  previewEligibilityCount,
  syncWaveAssignments,
  toEligibilityRuleInput,
} from "../lib/survey-eligibility-service";
import {
  enrichSurveyResponseScores,
  getGhq28DistressLevel,
  getSurveyInstrumentLabel,
  getSurveyRiskLevel,
  isGhq28SurveyTitle,
} from "../lib/survey-scoring";
import { formatStudentIdForResponse } from "../lib/user-format";

const nullableDateSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value);
  }
  return value;
}, z.date().nullable());

const eligibilityRuleSchema = z.object({
  priorRiskLevels: z.array(z.nativeEnum(RiskLevel)).default([]),
  wellnessSignalCodes: z.array(z.nativeEnum(WellnessTrendSignalCode)).default([]),
  studyYears: z.array(z.coerce.number().int().min(1).max(8)).default([]),
  sections: z.array(z.string().trim().min(1).max(40)).default([]),
});

const createWaveSchema = z
  .object({
    label: z.string().trim().min(1).max(200),
    termKey: z.union([z.string().trim().max(40), z.literal(""), z.null()]).optional(),
    weekStart: nullableDateSchema.optional().default(null),
    opensAt: nullableDateSchema,
    closesAt: nullableDateSchema.optional().default(null),
    openNow: z.boolean().optional().default(false),
  })
  .superRefine((wave, context) => {
    if (!wave.opensAt && !wave.openNow) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["opensAt"],
        message: "opensAt is required unless openNow is true",
      });
    }
    if (wave.opensAt && wave.closesAt && wave.opensAt >= wave.closesAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closesAt"],
        message: "closesAt must be after opensAt",
      });
    }
  });

const eligibilityPreviewSchema = z.object({
  audienceType: z.nativeEnum(SurveyAudienceType),
  rule: eligibilityRuleSchema.nullable().optional(),
});

const serializeWave = (wave: {
  id: string;
  surveyId: string;
  label: string;
  termKey: string | null;
  weekStart: Date | null;
  opensAt: Date;
  closesAt: Date | null;
  status: SurveyWaveStatus;
  createdAt: Date;
  updatedAt: Date;
  _count?: { assignments?: number; responses?: number };
}) => ({
  id: wave.id,
  surveyId: wave.surveyId,
  label: wave.label,
  termKey: wave.termKey,
  weekStart: wave.weekStart,
  opensAt: wave.opensAt,
  closesAt: wave.closesAt,
  status: wave.status,
  createdAt: wave.createdAt,
  updatedAt: wave.updatedAt,
  assignmentCount: wave._count?.assignments ?? 0,
  responseCount: wave._count?.responses ?? 0,
});

/** ซิงก์ isActive/startsAt/endsAt ของ Survey จากคลื่นที่ OPEN ล่าสุด */
export async function syncSurveyActiveFromWaves(
  tx: Prisma.TransactionClient,
  surveyId: string
): Promise<void> {
  const openWave = await tx.surveyWave.findFirst({
    where: { surveyId, status: SurveyWaveStatus.OPEN },
    orderBy: { opensAt: "desc" },
  });

  await tx.survey.update({
    where: { id: surveyId },
    data: {
      isActive: Boolean(openWave),
      startsAt: openWave?.opensAt ?? null,
      endsAt: openWave?.closesAt ?? null,
      status: openWave ? SurveyStatus.PUBLISHED : undefined,
    },
  });

  if (openWave) {
    await tx.survey.updateMany({
      where: {
        id: { not: surveyId },
        isActive: true,
      },
      data: { isActive: false },
    });
  }
}

/** รายการคลื่นของแบบประเมิน */
export const listAdminSurveyWaves = async (req: Request, res: Response): Promise<void> => {
  if (!hasAssignedRole(req.user, Role.ADMIN)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!survey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    const waves = await prisma.surveyWave.findMany({
      where: { surveyId: survey.id },
      orderBy: [{ opensAt: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            assignments: true,
            responses: true,
          },
        },
      },
    });

    res.status(200).json({ waves: waves.map(serializeWave) });
  } catch (error) {
    console.error("List survey waves error:", error);
    res.status(500).json({ message: "Failed to list survey waves" });
  }
};

/** สร้างคลื่นใหม่ และเปิดทันทีถ้า openNow */
export const createAdminSurveyWave = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  if (!hasAssignedRole(req.user, Role.ADMIN)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = createWaveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: { eligibilityRule: true },
    });
    if (!survey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    const opensAt = parsed.data.openNow ? new Date() : (parsed.data.opensAt as Date);
    const status = parsed.data.openNow ? SurveyWaveStatus.OPEN : SurveyWaveStatus.SCHEDULED;

    const wave = await prisma.$transaction(async (tx) => {
      if (parsed.data.openNow) {
        await tx.surveyWave.updateMany({
          where: { surveyId: survey.id, status: SurveyWaveStatus.OPEN },
          data: { status: SurveyWaveStatus.CLOSED, closesAt: new Date() },
        });
      }

      const created = await tx.surveyWave.create({
        data: {
          surveyId: survey.id,
          label: parsed.data.label.trim(),
          termKey: parsed.data.termKey?.trim() || null,
          weekStart: parsed.data.weekStart,
          opensAt,
          closesAt: parsed.data.closesAt,
          status,
        },
      });

      if (parsed.data.openNow) {
        await syncWaveAssignments({
          waveId: created.id,
          audienceType: survey.audienceType,
          rule: toEligibilityRuleInput(survey.eligibilityRule),
          db: tx,
        });
        await syncSurveyActiveFromWaves(tx, survey.id);
      }

      return created;
    });

    await writeAuditLog({
      actorUserId,
      action: "admin.survey.wave.create",
      entityType: "SurveyWave",
      entityId: wave.id,
      description: `Created wave "${wave.label}" for survey ${survey.id}`,
      ipAddress: getRequestIpAddress(req),
    });

    const withCount = await prisma.surveyWave.findUnique({
      where: { id: wave.id },
      include: {
        _count: { select: { assignments: true, responses: true } },
      },
    });

    res.status(201).json({
      message: "Wave created successfully",
      wave: withCount ? serializeWave(withCount) : serializeWave({ ...wave, _count: {} }),
    });
  } catch (error) {
    console.error("Create survey wave error:", error);
    res.status(500).json({ message: "Failed to create survey wave" });
  }
};

/** เปิดคลื่น — สร้าง assignment ตามกฎ และปิดคลื่นอื่นของแบบเดียวกัน */
export const openAdminSurveyWave = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  if (!hasAssignedRole(req.user, Role.ADMIN)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: { eligibilityRule: true },
    });
    if (!survey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    const wave = await prisma.surveyWave.findFirst({
      where: { id: req.params.waveId, surveyId: survey.id },
    });
    if (!wave) {
      res.status(404).json({ message: "Wave not found" });
      return;
    }

    if (wave.status === SurveyWaveStatus.CANCELLED) {
      res.status(400).json({ message: "Cancelled wave cannot be opened" });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.surveyWave.updateMany({
        where: {
          surveyId: survey.id,
          status: SurveyWaveStatus.OPEN,
          id: { not: wave.id },
        },
        data: { status: SurveyWaveStatus.CLOSED, closesAt: new Date() },
      });

      const opened = await tx.surveyWave.update({
        where: { id: wave.id },
        data: {
          status: SurveyWaveStatus.OPEN,
          opensAt: wave.opensAt > new Date() ? new Date() : wave.opensAt,
        },
        include: {
          _count: { select: { assignments: true, responses: true } },
        },
      });

      await syncWaveAssignments({
        waveId: opened.id,
        audienceType: survey.audienceType,
        rule: toEligibilityRuleInput(survey.eligibilityRule),
        db: tx,
      });
      await syncSurveyActiveFromWaves(tx, survey.id);

      return opened;
    });

    // n = จำนวน assignment — สร้าง Alert แบบ batch แล้วค่อยส่งเมลทีละคนเมื่อเปิด EMAIL_NOTIFY_ON_WAVE_OPEN
    const assignees = await prisma.surveyAssignment.findMany({
      where: { waveId: updated.id },
      select: {
        student: {
          select: { id: true, email: true, name: true },
        },
      },
    });
    const students = assignees
      .map((row) => row.student)
      .filter((student): student is { id: string; email: string | null; name: string } => Boolean(student?.id));

    const alertTitle = "มีแบบประเมินเปิดให้ทำแล้ว";
    const alertMessage = `รอบ "${updated.label}" ของแบบประเมิน "${survey.title}" เปิดแล้ว — กรุณาเข้าสู่ระบบเพื่อทำแบบประเมิน`;
    if (students.length > 0) {
      await prisma.alert.createMany({
        data: students.map((student) => ({
          recipientUserId: student.id,
          actorUserId: actorUserId ?? null,
          studentId: student.id,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: alertTitle,
          message: alertMessage,
          sourceType: "SurveyWave",
          sourceId: updated.id,
        })),
      });
    }

    const notifyEmailOnOpen = `${process.env.EMAIL_NOTIFY_ON_WAVE_OPEN || "false"}`.toLowerCase() === "true";
    if (notifyEmailOnOpen) {
      const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:3000";
      for (const student of students) {
        if (!student.email) {
          continue;
        }
        await notifyUser({
          recipientUserId: student.id,
          recipientEmail: student.email,
          channels: { inApp: false, email: true },
          email: {
            subject: `NuCare: แบบประเมิน "${survey.title}" เปิดแล้ว`,
            text: `เรียน ${student.name}\n\nรอบ "${updated.label}" ของแบบประเมิน "${survey.title}" เปิดให้ทำแล้ว\nเข้าสู่ระบบ: ${clientOrigin}/student/assessment`,
          },
        });
      }
    }
    const notifiedCount = students.length;

    await writeAuditLog({
      actorUserId,
      action: "admin.survey.wave.open",
      entityType: "SurveyWave",
      entityId: updated.id,
      description: `Opened wave "${updated.label}" · notified ${notifiedCount} student(s)`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Wave opened successfully",
      wave: serializeWave(updated),
      notifiedCount,
    });
  } catch (error) {
    console.error("Open survey wave error:", error);
    res.status(500).json({ message: "Failed to open survey wave" });
  }
};

/** ปิดคลื่นที่เปิดอยู่ */
export const closeAdminSurveyWave = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  if (!hasAssignedRole(req.user, Role.ADMIN)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const wave = await prisma.surveyWave.findFirst({
      where: { id: req.params.waveId, surveyId: req.params.id },
    });
    if (!wave) {
      res.status(404).json({ message: "Wave not found" });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.surveyWave.update({
        where: { id: wave.id },
        data: {
          status: SurveyWaveStatus.CLOSED,
          closesAt: new Date(),
        },
        include: {
          _count: { select: { assignments: true, responses: true } },
        },
      });
      await syncSurveyActiveFromWaves(tx, req.params.id);
      return closed;
    });

    await writeAuditLog({
      actorUserId,
      action: "admin.survey.wave.close",
      entityType: "SurveyWave",
      entityId: updated.id,
      description: `Closed wave "${updated.label}"`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Wave closed successfully",
      wave: serializeWave(updated),
    });
  } catch (error) {
    console.error("Close survey wave error:", error);
    res.status(500).json({ message: "Failed to close survey wave" });
  }
};

/** ดูจำนวนนักศึกษาที่เข้าเกณฑ์ (ไม่คืนรายชื่อ) */
export const previewAdminSurveyEligibility = async (req: Request, res: Response): Promise<void> => {
  if (!hasAssignedRole(req.user, Role.ADMIN)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = eligibilityPreviewSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid payload", errors: parsed.error.flatten() });
    return;
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: { eligibilityRule: true },
    });
    if (!survey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    const rule =
      parsed.data.rule !== undefined
        ? parsed.data.rule
        : toEligibilityRuleInput(survey.eligibilityRule);

    const matchedCount = await previewEligibilityCount({
      audienceType: parsed.data.audienceType,
      rule,
    });

    res.status(200).json({ matchedCount });
  } catch (error) {
    console.error("Preview survey eligibility error:", error);
    res.status(500).json({ message: "Failed to preview eligibility" });
  }
};

/** รายการคำตอบต่อคลื่น (มีคะแนน/เสี่ยง — ทีมเท่านั้น) */
export const listAdminSurveyWaveResponses = async (req: Request, res: Response): Promise<void> => {
  if (!hasAssignedRole(req.user, Role.ADMIN)) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const wave = await prisma.surveyWave.findFirst({
      where: { id: req.params.waveId, surveyId: req.params.id },
      include: {
        survey: {
          select: { id: true, title: true },
        },
      },
    });
    if (!wave) {
      res.status(404).json({ message: "Wave not found" });
      return;
    }

    const responses = await prisma.surveyResponse.findMany({
      where: { waveId: wave.id },
      orderBy: { submittedAt: "desc" },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            studentId: true,
            studyYear: true,
            section: true,
            email: true,
          },
        },
        answers: true,
      },
    });

    const surveyQuestions = await prisma.surveyQuestion.findMany({
      where: { surveyId: wave.surveyId },
      orderBy: { order: "asc" },
    });

    res.status(200).json({
      wave: serializeWave({ ...wave, _count: { responses: responses.length } }),
      responses: responses.map((response) => {
        const scored =
          response.totalScore === null
            ? enrichSurveyResponseScores(wave.survey.title, surveyQuestions, response.answers)
            : null;
        const totalScore = response.totalScore ?? scored?.totalScore ?? 0;
        const maxScore = response.maxScore || scored?.maxScore || 0;
        const scorePercent =
          response.scorePercent ??
          scored?.scorePercent ??
          (maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : null);
        const riskLevel =
          response.totalScore === null || response.maxScore <= 0
            ? getSurveyRiskLevel(wave.survey.title, totalScore, maxScore)
            : response.riskLevel;
        const distress = isGhq28SurveyTitle(wave.survey.title)
          ? getGhq28DistressLevel(totalScore)
          : null;

        return {
          id: response.id,
          submittedAt: response.submittedAt,
          totalScore,
          maxScore,
          scorePercent,
          riskLevel,
          instrument: response.instrument ?? getSurveyInstrumentLabel(wave.survey.title),
          distressLevel: distress?.level ?? null,
          distressLabel: distress?.labelTh ?? null,
          scoredAt: response.scoredAt ?? response.submittedAt,
          student: {
            ...response.student,
            studentId: formatStudentIdForResponse(response.student.studentId),
          },
        };
      }),
    });
  } catch (error) {
    console.error("List wave responses error:", error);
    res.status(500).json({ message: "Failed to list wave responses" });
  }
};

export const surveyWaveSchemas = {
  eligibilityRuleSchema,
  createWaveSchema,
};

export type SurveyScheduleMeta = {
  frequency: SurveyFrequency;
  audienceType: SurveyAudienceType;
  instrumentCode: SurveyInstrumentCode;
};
