import "../src/lib/env";
import { randomBytes } from "crypto";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";
import {
  PrismaClient,
  Role,
  SurveyQuestionType,
  SurveyStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

type CheckResult = {
  errors: string[];
  warnings: string[];
  info: Record<string, unknown>;
};

type SurveyQuestionLike = {
  id: string;
  type: SurveyQuestionType;
  prompt: string;
  isRequired: boolean;
  options: unknown;
  minValue: number | null;
  maxValue: number | null;
};

const ORIENTATION_SURVEY_TITLE = "แบบทดสอบสุขภาพทั่วไป Thai GHQ-28";

const createResult = (): CheckResult => ({
  errors: [],
  warnings: [],
  info: {},
});

const getBackupDirectory = (): string =>
  path.resolve(process.env.SURVEY_BACKUP_DIR || path.join(process.cwd(), "backups", "surveys"));

const readEnv = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value || undefined;
};

const validateEnvironment = (result: CheckResult): void => {
  for (const name of ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"]) {
    if (!readEnv(name)) {
      result.errors.push(`${name} is not configured`);
    }
  }

  if ((readEnv("JWT_ACCESS_SECRET")?.length || 0) < 32) {
    result.warnings.push("JWT_ACCESS_SECRET is shorter than 32 characters");
  }

  if ((readEnv("JWT_REFRESH_SECRET")?.length || 0) < 32) {
    result.warnings.push("JWT_REFRESH_SECRET is shorter than 32 characters");
  }

  if (!readEnv("CLIENT_ORIGIN")) {
    result.warnings.push("CLIENT_ORIGIN is not configured; CORS will fall back to http://localhost:3000");
  }
};

const validateChoiceOptions = (question: SurveyQuestionLike, result: CheckResult): void => {
  if (
    question.type !== SurveyQuestionType.SINGLE_CHOICE &&
    question.type !== SurveyQuestionType.MULTIPLE_CHOICE
  ) {
    return;
  }

  if (!Array.isArray(question.options) || question.options.length < 2) {
    result.errors.push(`Choice question "${question.prompt}" must have at least two options`);
    return;
  }

  const values = new Set<string>();
  for (const option of question.options) {
    if (typeof option !== "object" || option === null) {
      result.errors.push(`Choice question "${question.prompt}" has an invalid option`);
      continue;
    }

    const label = "label" in option ? String(option.label).trim() : "";
    const value = "value" in option ? String(option.value).trim() : "";

    if (!label || !value) {
      result.errors.push(`Choice question "${question.prompt}" has a blank option label/value`);
    }

    if (values.has(value)) {
      result.errors.push(`Choice question "${question.prompt}" has duplicate option value "${value}"`);
    }

    values.add(value);
  }
};

const validateQuestion = (question: SurveyQuestionLike, result: CheckResult): void => {
  if (!question.prompt.trim()) {
    result.errors.push(`Question ${question.id} has a blank prompt`);
  }

  validateChoiceOptions(question, result);

  if (
    (question.type === SurveyQuestionType.SCALE || question.type === SurveyQuestionType.NUMBER) &&
    question.minValue !== null &&
    question.maxValue !== null &&
    question.minValue >= question.maxValue
  ) {
    result.errors.push(`Numeric question "${question.prompt}" has minValue >= maxValue`);
  }
};

const validateBackupDirectory = async (result: CheckResult): Promise<void> => {
  const backupDirectory = getBackupDirectory();
  const probePath = path.join(backupDirectory, `.readiness-${randomBytes(6).toString("hex")}.tmp`);

  result.info.backupDirectory = backupDirectory;

  try {
    await mkdir(backupDirectory, { recursive: true });
    await writeFile(probePath, "ok", "utf8");
    await rm(probePath, { force: true });
  } catch (error) {
    result.errors.push(
      `Backup directory is not writable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
};

const main = async (): Promise<void> => {
  const result = createResult();
  validateEnvironment(result);
  await validateBackupDirectory(result);

  const [
    activeAdminCount,
    activeStudentCount,
    totalSurveyCount,
    activeSurveys,
    orientationSurvey,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: Role.ADMIN,
        isActive: true,
      },
    }),
    prisma.user.count({
      where: {
        role: Role.STUDENT,
        isActive: true,
      },
    }),
    prisma.survey.count(),
    prisma.survey.findMany({
      where: {
        status: SurveyStatus.PUBLISHED,
        isActive: true,
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    }),
    prisma.survey.findFirst({
      where: {
        title: ORIENTATION_SURVEY_TITLE,
      },
      include: {
        questions: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    }),
  ]);

  result.info.activeAdminCount = activeAdminCount;
  result.info.activeStudentCount = activeStudentCount;
  result.info.totalSurveyCount = totalSurveyCount;
  result.info.activeSurveyCount = activeSurveys.length;
  result.info.orientationSurvey = orientationSurvey
    ? {
        id: orientationSurvey.id,
        status: orientationSurvey.status,
        isActive: orientationSurvey.isActive,
        questionCount: orientationSurvey.questions.length,
        responseCount: orientationSurvey._count.responses,
      }
    : null;

  if (activeAdminCount < 1) {
    result.errors.push("No active admin account found");
  }

  if (activeStudentCount < 1) {
    result.warnings.push("No active student accounts found; students cannot submit surveys yet");
  }

  if (!orientationSurvey) {
    result.warnings.push(`Default GHQ-28 survey "${ORIENTATION_SURVEY_TITLE}" does not exist`);
  } else {
    if (orientationSurvey.questions.length === 0) {
      result.errors.push("Default GHQ-28 survey has no questions");
    }

    for (const question of orientationSurvey.questions) {
      validateQuestion(question, result);
    }

    if (orientationSurvey.status !== SurveyStatus.PUBLISHED || !orientationSurvey.isActive) {
      result.warnings.push("Default GHQ-28 survey is not published/active yet");
    }
  }

  if (activeSurveys.length === 0) {
    result.warnings.push("No active published survey is available to students");
  }

  if (activeSurveys.length > 1) {
    result.errors.push("More than one active published survey is available to students");
  }

  for (const survey of activeSurveys) {
    if (survey.questions.length === 0) {
      result.errors.push(`Active survey "${survey.title}" has no questions`);
    }

    for (const question of survey.questions) {
      validateQuestion(question, result);
    }
  }

  const status = result.errors.length > 0 ? "ERROR" : result.warnings.length > 0 ? "WARNING" : "OK";
  const output = {
    status,
    checkedAt: new Date().toISOString(),
    ...result,
  };

  console.log(JSON.stringify(output, null, 2));

  if (result.errors.length > 0) {
    process.exitCode = 1;
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
