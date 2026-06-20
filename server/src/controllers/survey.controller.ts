import {
  Prisma,
  Role,
  SurveyQuestionType,
  SurveyStatus,
} from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import {
  calculateSurveyMaxScore,
  calculateSurveyResponseScore,
  calculateSurveyScorePercent,
  enrichSurveyResponseScores,
  getGhq28DistressLevel,
  getSurveyInstrumentLabel,
  getSurveyRiskLevel,
  isGhq28SurveyTitle,
} from "../lib/survey-scoring";
import { formatStudentIdForResponse } from "../lib/user-format";

const MAX_SURVEY_QUESTIONS = 100;
const MAX_QUESTION_OPTIONS = 50;

const surveyQuestionOptionSchema = z.object({
  label: z.string().trim().min(1).max(200),
  score: z.union([z.coerce.number().int(), z.literal(""), z.null(), z.undefined()]).optional(),
  value: z.string().trim().min(1).max(120),
});

const surveyQuestionInputSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    type: z.nativeEnum(SurveyQuestionType),
    prompt: z.string().trim().min(1).max(800),
    description: z.union([z.string().trim().max(1200), z.literal(""), z.null()]).optional(),
    isRequired: z.boolean().default(true),
    order: z.coerce.number().int().min(1).max(MAX_SURVEY_QUESTIONS).optional(),
    options: z.array(surveyQuestionOptionSchema).max(MAX_QUESTION_OPTIONS).optional(),
    minValue: z.union([z.coerce.number().int(), z.literal(""), z.null(), z.undefined()]).optional(),
    maxValue: z.union([z.coerce.number().int(), z.literal(""), z.null(), z.undefined()]).optional(),
  })
  .superRefine((question, context) => {
    const requiresOptions =
      question.type === SurveyQuestionType.SINGLE_CHOICE ||
      question.type === SurveyQuestionType.MULTIPLE_CHOICE;

    if (requiresOptions && (!question.options || question.options.length < 2)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Choice questions require at least two options",
      });
    }

    if (question.options) {
      const optionValues = new Set(question.options.map((option) => option.value));
      if (optionValues.size !== question.options.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Choice option values must be unique",
        });
      }
    }

    const hasRange =
      question.type === SurveyQuestionType.SCALE ||
      question.type === SurveyQuestionType.NUMBER;

    if (hasRange) {
      const minValue = normalizeNullableNumber(question.minValue);
      const maxValue = normalizeNullableNumber(question.maxValue);

      if (minValue !== null && maxValue !== null && minValue >= maxValue) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["maxValue"],
          message: "Maximum value must be greater than minimum value",
        });
      }
    }
  });

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

const surveyPayloadSchema = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.union([z.string().trim().max(4000), z.literal(""), z.null()]).optional(),
    status: z.nativeEnum(SurveyStatus).default(SurveyStatus.DRAFT),
    isActive: z.boolean().default(false),
    startsAt: nullableDateSchema.optional().default(null),
    endsAt: nullableDateSchema.optional().default(null),
    questions: z.array(surveyQuestionInputSchema).min(1).max(MAX_SURVEY_QUESTIONS),
  })
  .superRefine((survey, context) => {
    if (survey.startsAt && survey.endsAt && survey.startsAt >= survey.endsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End date must be after start date",
      });
    }
  });

const submitSurveyResponseSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().trim().min(1),
        value: z.unknown(),
      })
    )
    .min(1)
    .max(MAX_SURVEY_QUESTIONS),
});

type SurveyQuestionInput = z.infer<typeof surveyQuestionInputSchema>;
type SurveyPayload = z.infer<typeof surveyPayloadSchema>;
type SurveyQuestionOption = z.infer<typeof surveyQuestionOptionSchema>;

type SurveyQuestionForValidation = {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  isRequired: boolean;
  options: Prisma.JsonValue | null;
  minValue: number | null;
  maxValue: number | null;
};

type ScoredSurveyQuestionOption = {
  label: string;
  score: number | null;
  value: string;
};

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDescription = (value?: string | null): string | null => {
  const normalized = value?.trim() || "";
  return normalized.length > 0 ? normalized : null;
};

const normalizeSurveyStatus = (payload: SurveyPayload): SurveyStatus =>
  payload.isActive ? SurveyStatus.PUBLISHED : payload.status;

const normalizeSurveyIsActive = (payload: SurveyPayload): boolean =>
  payload.isActive && normalizeSurveyStatus(payload) === SurveyStatus.PUBLISHED;

const normalizeQuestionOptions = (
  question: SurveyQuestionInput
): SurveyQuestionOption[] | undefined => {
  if (
    question.type !== SurveyQuestionType.SINGLE_CHOICE &&
    question.type !== SurveyQuestionType.MULTIPLE_CHOICE
  ) {
    return undefined;
  }

  return (question.options || []).map((option) => ({
    label: option.label.trim(),
    score: normalizeNullableNumber(option.score),
    value: option.value.trim(),
  }));
};

const normalizeQuestionForWrite = (question: SurveyQuestionInput, index: number) => ({
  type: question.type,
  prompt: question.prompt.trim(),
  description: normalizeDescription(question.description),
  isRequired: question.isRequired,
  order: question.order ?? index + 1,
  options: normalizeQuestionOptions(question),
  minValue: normalizeNullableNumber(question.minValue),
  maxValue: normalizeNullableNumber(question.maxValue),
});

const serializeQuestion = (question: {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  description: string | null;
  isRequired: boolean;
  order: number;
  options: Prisma.JsonValue | null;
  minValue: number | null;
  maxValue: number | null;
}) => ({
  ...question,
  options: Array.isArray(question.options) ? question.options : [],
});

const serializeSurvey = (survey: {
  id: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: {
    id: string;
    name: string;
  } | null;
  questions?: Array<{
    id: string;
    type: SurveyQuestionType;
    prompt: string;
    description: string | null;
    isRequired: boolean;
    order: number;
    options: Prisma.JsonValue | null;
    minValue: number | null;
    maxValue: number | null;
  }>;
  _count?: {
    questions?: number;
    responses?: number;
  };
}) => ({
  id: survey.id,
  title: survey.title,
  description: survey.description,
  status: survey.status,
  isActive: survey.isActive,
  startsAt: survey.startsAt,
  endsAt: survey.endsAt,
  createdAt: survey.createdAt,
  updatedAt: survey.updatedAt,
  createdBy: survey.createdBy || null,
  questionCount: survey._count?.questions ?? survey.questions?.length ?? 0,
  responseCount: survey._count?.responses ?? 0,
  questions: survey.questions?.map(serializeQuestion) || [],
});

const getChoiceOptions = (question: SurveyQuestionForValidation): ScoredSurveyQuestionOption[] => {
  if (!Array.isArray(question.options)) {
    return [];
  }

  return question.options.flatMap((option) => {
    if (typeof option !== "object" || option === null || Array.isArray(option)) {
      return [];
    }

    const record = option as Record<string, unknown>;
    const label = typeof record.label === "string" ? record.label.trim() : "";
    const value = typeof record.value === "string" ? record.value.trim() : "";
    const score = normalizeNullableNumber(record.score);

    return label && value ? [{ label, score, value }] : [];
  });
};

const isBlankAnswer = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim().length === 0) ||
  (Array.isArray(value) && value.length === 0);

const normalizeTextAnswer = (
  value: unknown,
  maxLength: number
): Prisma.InputJsonValue | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    return null;
  }

  return normalized;
};

const normalizeChoiceAnswer = (
  question: SurveyQuestionForValidation,
  value: unknown
): Prisma.InputJsonValue | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  const optionValues = new Set(getChoiceOptions(question).map((option) => option.value));

  return optionValues.has(normalized) ? normalized : null;
};

const normalizeMultiChoiceAnswer = (
  question: SurveyQuestionForValidation,
  value: unknown
): Prisma.InputJsonValue | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const selectedValues = value.map((item) => String(item).trim()).filter(Boolean);
  const uniqueValues = Array.from(new Set(selectedValues));

  if (selectedValues.length !== uniqueValues.length) {
    return null;
  }

  const optionValues = new Set(getChoiceOptions(question).map((option) => option.value));
  if (uniqueValues.some((item) => !optionValues.has(item))) {
    return null;
  }

  return uniqueValues;
};

const normalizeNumericAnswer = (
  question: SurveyQuestionForValidation,
  value: unknown,
  requireInteger: boolean
): Prisma.InputJsonValue | null => {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (requireInteger && !Number.isInteger(parsed)) {
    return null;
  }

  const minValue = question.minValue ?? (question.type === SurveyQuestionType.SCALE ? 1 : null);
  const maxValue = question.maxValue ?? (question.type === SurveyQuestionType.SCALE ? 5 : null);

  if (minValue !== null && parsed < minValue) {
    return null;
  }

  if (maxValue !== null && parsed > maxValue) {
    return null;
  }

  return parsed;
};

const normalizeDateAnswer = (value: unknown): Prisma.InputJsonValue | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return normalized;
};

const normalizeAnswerForQuestion = (
  question: SurveyQuestionForValidation,
  value: unknown
): Prisma.InputJsonValue | null => {
  switch (question.type) {
    case SurveyQuestionType.TEXT:
      return normalizeTextAnswer(value, 2000);
    case SurveyQuestionType.TEXTAREA:
      return normalizeTextAnswer(value, 8000);
    case SurveyQuestionType.SINGLE_CHOICE:
      return normalizeChoiceAnswer(question, value);
    case SurveyQuestionType.MULTIPLE_CHOICE:
      return normalizeMultiChoiceAnswer(question, value);
    case SurveyQuestionType.SCALE:
      return normalizeNumericAnswer(question, value, true);
    case SurveyQuestionType.NUMBER:
      return normalizeNumericAnswer(question, value, false);
    case SurveyQuestionType.DATE:
      return normalizeDateAnswer(value);
    default:
      return null;
  }
};

const buildStudentSurveyWhere = (surveyId?: string) => {
  const now = new Date();

  return {
    ...(surveyId ? { id: surveyId } : {}),
    status: SurveyStatus.PUBLISHED,
    isActive: true,
    AND: [
      {
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      },
      {
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    ],
  };
};

const deactivateOtherSurveysIfNeeded = async (
  tx: Prisma.TransactionClient,
  surveyId: string,
  isActive: boolean
): Promise<void> => {
  if (!isActive) {
    return;
  }

  await tx.survey.updateMany({
    where: {
      id: {
        not: surveyId,
      },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
};

export const listAdminSurveys = async (req: Request, res: Response): Promise<void> => {
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const surveys = await prisma.survey.findMany({
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });

    res.status(200).json({
      surveys: surveys.map(serializeSurvey),
    });
  } catch (error) {
    console.error("List admin surveys error:", error);
    res.status(500).json({ message: "Failed to list surveys" });
  }
};

export const getAdminSurvey = async (req: Request, res: Response): Promise<void> => {
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            questions: true,
            responses: true,
          },
        },
      },
    });

    if (!survey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    res.status(200).json({
      survey: serializeSurvey(survey),
    });
  } catch (error) {
    console.error("Get admin survey error:", error);
    res.status(500).json({ message: "Failed to fetch survey" });
  }
};

export const createAdminSurvey = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = surveyPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const status = normalizeSurveyStatus(parsed.data);
  const isActive = normalizeSurveyIsActive(parsed.data);

  try {
    const survey = await prisma.$transaction(async (tx) => {
      const createdSurvey = await tx.survey.create({
        data: {
          title: parsed.data.title.trim(),
          description: normalizeDescription(parsed.data.description),
          status,
          isActive,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          createdById: actorUserId,
          questions: {
            create: parsed.data.questions.map((question, index) =>
              normalizeQuestionForWrite(question, index)
            ),
          },
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          questions: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              questions: true,
              responses: true,
            },
          },
        },
      });

      await deactivateOtherSurveysIfNeeded(tx, createdSurvey.id, createdSurvey.isActive);
      return createdSurvey;
    });

    await writeAuditLog({
      actorUserId,
      action: "admin.survey.create",
      entityType: "Survey",
      entityId: survey.id,
      description: `Created survey "${survey.title}"`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "Survey created successfully",
      survey: serializeSurvey(survey),
    });
  } catch (error) {
    console.error("Create admin survey error:", error);
    res.status(500).json({ message: "Failed to create survey" });
  }
};

export const updateAdminSurvey = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const parsed = surveyPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  const status = normalizeSurveyStatus(parsed.data);
  const isActive = normalizeSurveyIsActive(parsed.data);

  try {
    const existingSurvey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: {
        questions: {
          select: {
            id: true,
            type: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    if (!existingSurvey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    const hasResponses = existingSurvey._count.responses > 0;

    if (hasResponses) {
      const submittedQuestionIds = new Set(parsed.data.questions.map((question) => question.id).filter(Boolean));
      const missingQuestion = existingSurvey.questions.find((question) => !submittedQuestionIds.has(question.id));

      if (missingQuestion) {
        res.status(409).json({
          message: "Cannot remove questions after students have submitted responses",
        });
        return;
      }

      const existingQuestionTypeById = new Map(
        existingSurvey.questions.map((question) => [question.id, question.type])
      );
      const changedTypeQuestion = parsed.data.questions.find(
        (question) => question.id && existingQuestionTypeById.get(question.id) !== question.type
      );

      if (changedTypeQuestion) {
        res.status(409).json({
          message: "Cannot change a question type after students have submitted responses",
        });
        return;
      }
    }

    const survey = await prisma.$transaction(async (tx) => {
      await tx.survey.update({
        where: { id: existingSurvey.id },
        data: {
          title: parsed.data.title.trim(),
          description: normalizeDescription(parsed.data.description),
          status,
          isActive,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
        },
      });

      if (!hasResponses) {
        await tx.surveyQuestion.deleteMany({
          where: {
            surveyId: existingSurvey.id,
          },
        });

        await tx.surveyQuestion.createMany({
          data: parsed.data.questions.map((question, index) => ({
            surveyId: existingSurvey.id,
            ...normalizeQuestionForWrite(question, index),
          })),
        });
      } else {
        for (const [index, question] of parsed.data.questions.entries()) {
          const normalizedQuestion = normalizeQuestionForWrite(question, index);

          if (question.id) {
            await tx.surveyQuestion.update({
              where: {
                id: question.id,
              },
              data: normalizedQuestion,
            });
          } else {
            await tx.surveyQuestion.create({
              data: {
                surveyId: existingSurvey.id,
                ...normalizedQuestion,
              },
            });
          }
        }
      }

      await deactivateOtherSurveysIfNeeded(tx, existingSurvey.id, isActive);

      return tx.survey.findUniqueOrThrow({
        where: { id: existingSurvey.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          questions: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: {
              questions: true,
              responses: true,
            },
          },
        },
      });
    });

    await writeAuditLog({
      actorUserId,
      action: "admin.survey.update",
      entityType: "Survey",
      entityId: survey.id,
      description: `Updated survey "${survey.title}"`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Survey updated successfully",
      survey: serializeSurvey(survey),
    });
  } catch (error) {
    console.error("Update admin survey error:", error);
    res.status(500).json({ message: "Failed to update survey" });
  }
};

export const deleteAdminSurvey = async (req: Request, res: Response): Promise<void> => {
  const actorUserId = req.user?.userId;
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const force = req.query.force === "true";

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        title: true,
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    if (!survey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    if (survey._count.responses > 0 && !force) {
      res.status(409).json({
        message: "Cannot delete a survey after students have submitted responses. Archive it instead.",
      });
      return;
    }

    if (survey._count.responses > 0 && force) {
      await prisma.$transaction(async (tx) => {
        await tx.surveyAnswer.deleteMany({
          where: { response: { surveyId: survey.id } },
        });
        await tx.surveyResponse.deleteMany({
          where: { surveyId: survey.id },
        });
        await tx.surveyQuestion.deleteMany({
          where: { surveyId: survey.id },
        });
        await tx.survey.delete({
          where: { id: survey.id },
        });
      });
    } else {
      await prisma.survey.delete({
        where: { id: survey.id },
      });
    }

    await writeAuditLog({
      actorUserId,
      action: "admin.survey.delete",
      entityType: "Survey",
      entityId: survey.id,
      description: force
        ? `Force-deleted survey "${survey.title}" including ${survey._count.responses} response(s)`
        : `Deleted survey "${survey.title}"`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json({
      message: "Survey deleted successfully",
    });
  } catch (error) {
    console.error("Delete admin survey error:", error);
    res.status(500).json({ message: "Failed to delete survey" });
  }
};

export const listAdminSurveyResponses = async (req: Request, res: Response): Promise<void> => {
  if (req.user?.role !== Role.ADMIN) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  try {
    const survey = await prisma.survey.findUnique({
      where: { id: req.params.id },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        responses: {
          orderBy: {
            submittedAt: "desc",
          },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                studentId: true,
                studyYear: true,
                section: true,
              },
            },
            answers: true,
          },
        },
      },
    });

    if (!survey) {
      res.status(404).json({ message: "Survey not found" });
      return;
    }

    const fallbackMaxScore = calculateSurveyMaxScore(survey.questions, survey.title);

    res.status(200).json({
      survey: serializeSurvey({
        ...survey,
        _count: {
          questions: survey.questions.length,
          responses: survey.responses.length,
        },
      }),
      responses: survey.responses.map((response) => {
        const maxScore = response.maxScore > 0 ? response.maxScore : fallbackMaxScore;
        const totalScore =
          response.totalScore ??
          calculateSurveyResponseScore(survey.questions, response.answers, survey.title);
        const scorePercent =
          response.scorePercent ?? calculateSurveyScorePercent(totalScore, maxScore);
        const instrument = response.instrument ?? getSurveyInstrumentLabel(survey.title);
        const riskLevel =
          response.totalScore === null || response.maxScore <= 0
            ? getSurveyRiskLevel(survey.title, totalScore, maxScore)
            : response.riskLevel;
        const distress = isGhq28SurveyTitle(survey.title) ? getGhq28DistressLevel(totalScore) : null;

        return {
          id: response.id,
          submittedAt: response.submittedAt,
          totalScore,
          maxScore,
          scorePercent,
          riskLevel,
          instrument,
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
    console.error("List admin survey responses error:", error);
    res.status(500).json({ message: "Failed to list survey responses" });
  }
};

export const getActiveStudentSurvey = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const survey = await prisma.survey.findFirst({
      where: buildStudentSurveyWhere(),
      orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        responses: {
          where: {
            studentId: userId,
          },
          orderBy: {
            submittedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            submittedAt: true,
          },
        },
      },
    });

    if (!survey) {
      res.status(200).json({ survey: null, response: null, hasSubmitted: false });
      return;
    }

    const response = survey.responses[0] || null;

    res.status(200).json({
      survey: serializeSurvey(survey),
      response: response
        ? {
            id: response.id,
            submittedAt: response.submittedAt,
          }
        : null,
      hasSubmitted: Boolean(response),
    });
  } catch (error) {
    console.error("Get active student survey error:", error);
    res.status(500).json({ message: "Failed to fetch active survey" });
  }
};

export const submitStudentSurveyResponse = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = submitSurveyResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const survey = await prisma.survey.findFirst({
      where: buildStudentSurveyWhere(req.params.id),
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!survey) {
      res.status(404).json({ message: "Survey is not available" });
      return;
    }

    const existingResponse = await prisma.surveyResponse.findUnique({
      where: {
        surveyId_studentId: {
          surveyId: survey.id,
          studentId: userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingResponse) {
      res.status(409).json({ message: "You have already submitted this survey" });
      return;
    }

    const answerByQuestionId = new Map<string, unknown>();
    for (const answer of parsed.data.answers) {
      if (answerByQuestionId.has(answer.questionId)) {
        res.status(400).json({ message: "Duplicate answers are not allowed" });
        return;
      }

      answerByQuestionId.set(answer.questionId, answer.value);
    }

    const normalizedAnswers: Array<{
      questionId: string;
      value: Prisma.InputJsonValue;
    }> = [];

    for (const question of survey.questions) {
      const rawAnswer = answerByQuestionId.get(question.id);

      if (isBlankAnswer(rawAnswer)) {
        if (question.isRequired) {
          res.status(400).json({
            message: `Required question is missing: ${question.prompt}`,
          });
          return;
        }

        continue;
      }

      const normalizedValue = normalizeAnswerForQuestion(question, rawAnswer);
      if (normalizedValue === null) {
        res.status(400).json({
          message: `Invalid answer for question: ${question.prompt}`,
        });
        return;
      }

      normalizedAnswers.push({
        questionId: question.id,
        value: normalizedValue,
      });
    }

    const unknownQuestionId = Array.from(answerByQuestionId.keys()).find(
      (questionId) => !survey.questions.some((question) => question.id === questionId)
    );
    if (unknownQuestionId) {
      res.status(400).json({ message: "One or more answers reference unknown questions" });
      return;
    }

    const {
      totalScore,
      maxScore,
      scorePercent,
      riskLevel,
      distressLevel,
      distressLabel,
    } = enrichSurveyResponseScores(survey.title, survey.questions, normalizedAnswers);
    const instrument = getSurveyInstrumentLabel(survey.title);
    const scoredAt = new Date();

    const surveyResponse = await prisma.surveyResponse.create({
      data: {
        surveyId: survey.id,
        studentId: userId,
        totalScore,
        maxScore,
        scorePercent,
        riskLevel,
        instrument,
        scoredAt,
        answers: {
          create: normalizedAnswers,
        },
      },
    });

    await writeAuditLog({
      actorUserId: userId,
      action: "student.survey.submit",
      entityType: "SurveyResponse",
      entityId: surveyResponse.id,
      description: `Submitted survey "${survey.title}"`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "Survey response submitted successfully",
      response: {
        id: surveyResponse.id,
        submittedAt: surveyResponse.submittedAt,
        totalScore,
        maxScore,
        scorePercent,
        riskLevel,
        distressLevel,
        distressLabel,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ message: "You have already submitted this survey" });
      return;
    }

    console.error("Submit student survey response error:", error);
    res.status(500).json({ message: "Failed to submit survey response" });
  }
};
