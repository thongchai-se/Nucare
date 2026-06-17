import "../src/lib/env";
import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PrismaClient, SurveyQuestionType } from "@prisma/client";

const prisma = new PrismaClient();

type BackupFile = {
  path: string;
  sha256: string;
  bytes: number;
};

type SurveyOption = {
  label: string;
  value: string;
};

const timestampForFile = (date = new Date()): string =>
  date.toISOString().replace(/[:.]/g, "-");

const resolveBackupDirectory = (): string =>
  path.resolve(process.env.SURVEY_BACKUP_DIR || path.join(process.cwd(), "backups", "surveys"));

const escapeCsvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const sanitizeFilePart = (value: string): string =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 90) || "survey";

const parseOptions = (value: unknown): SurveyOption[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((option) => {
      if (typeof option !== "object" || option === null) {
        return null;
      }

      const label = "label" in option ? String(option.label).trim() : "";
      const rawValue = "value" in option ? String(option.value).trim() : "";

      return label && rawValue ? { label, value: rawValue } : null;
    })
    .filter((option): option is SurveyOption => Boolean(option));
};

const buildOptionLabelMap = (question: {
  type: SurveyQuestionType;
  options: unknown;
}): Map<string, string> => {
  if (
    question.type !== SurveyQuestionType.SINGLE_CHOICE &&
    question.type !== SurveyQuestionType.MULTIPLE_CHOICE
  ) {
    return new Map();
  }

  return new Map(parseOptions(question.options).map((option) => [option.value, option.label]));
};

const formatAnswerValue = (
  value: unknown,
  optionLabelMap: Map<string, string>
): string => {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const rawValue = String(item);
        return optionLabelMap.get(rawValue) || rawValue;
      })
      .join("; ");
  }

  if (typeof value === "string") {
    return optionLabelMap.get(value) || value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
};

const writeBackupFile = async (
  filePath: string,
  contents: string
): Promise<BackupFile> => {
  await writeFile(filePath, contents, "utf8");
  return {
    path: filePath,
    sha256: createHash("sha256").update(contents, "utf8").digest("hex"),
    bytes: Buffer.byteLength(contents, "utf8"),
  };
};

const main = async (): Promise<void> => {
  const generatedAt = new Date();
  const backupDirectory = resolveBackupDirectory();
  await mkdir(backupDirectory, { recursive: true });

  const surveys = await prisma.survey.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
      responses: {
        orderBy: { submittedAt: "asc" },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              studentId: true,
              email: true,
              studyYear: true,
              section: true,
            },
          },
          answers: true,
        },
      },
    },
  });

  const timestamp = timestampForFile(generatedAt);
  const snapshot = {
    generatedAt: generatedAt.toISOString(),
    surveyCount: surveys.length,
    responseCount: surveys.reduce((sum, survey) => sum + survey.responses.length, 0),
    surveys,
  };

  const jsonFile = await writeBackupFile(
    path.join(backupDirectory, `survey-backup-${timestamp}.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`
  );

  const allResponseRows: string[][] = [
    [
      "surveyId",
      "surveyTitle",
      "surveyStatus",
      "surveyActive",
      "responseId",
      "submittedAt",
      "studentUserId",
      "studentId",
      "studentName",
      "studentEmail",
      "studyYear",
      "section",
      "questionId",
      "questionOrder",
      "questionType",
      "questionPrompt",
      "answer",
      "answerRawJson",
    ],
  ];

  const perSurveyCsvFiles: BackupFile[] = [];

  for (const survey of surveys) {
    const surveyRows = [allResponseRows[0]];
    const questionById = new Map(survey.questions.map((question) => [question.id, question]));

    for (const response of survey.responses) {
      const answerByQuestionId = new Map(
        response.answers.map((answer) => [answer.questionId, answer.value])
      );

      for (const question of survey.questions) {
        const value = answerByQuestionId.get(question.id) ?? null;
        const optionLabelMap = buildOptionLabelMap(question);
        const row = [
          survey.id,
          survey.title,
          survey.status,
          survey.isActive,
          response.id,
          response.submittedAt.toISOString(),
          response.student.id,
          response.student.studentId || "",
          response.student.name,
          response.student.email || "",
          response.student.studyYear ?? "",
          response.student.section || "",
          question.id,
          question.order,
          question.type,
          question.prompt,
          formatAnswerValue(value, optionLabelMap),
          value === null ? "" : JSON.stringify(value),
        ].map(escapeCsvCell);

        allResponseRows.push(row);
        surveyRows.push(row);
      }

      for (const answer of response.answers) {
        if (questionById.has(answer.questionId)) {
          continue;
        }

        const row = [
          survey.id,
          survey.title,
          survey.status,
          survey.isActive,
          response.id,
          response.submittedAt.toISOString(),
          response.student.id,
          response.student.studentId || "",
          response.student.name,
          response.student.email || "",
          response.student.studyYear ?? "",
          response.student.section || "",
          answer.questionId,
          "",
          "UNKNOWN",
          "Unknown question",
          formatAnswerValue(answer.value, new Map()),
          JSON.stringify(answer.value),
        ].map(escapeCsvCell);

        allResponseRows.push(row);
        surveyRows.push(row);
      }
    }

    perSurveyCsvFiles.push(
      await writeBackupFile(
        path.join(backupDirectory, `${sanitizeFilePart(survey.title)}-${survey.id}-${timestamp}.csv`),
        `\uFEFF${surveyRows.map((row) => row.join(",")).join("\r\n")}\r\n`
      )
    );
  }

  const combinedCsvFile = await writeBackupFile(
    path.join(backupDirectory, `survey-responses-${timestamp}.csv`),
    `\uFEFF${allResponseRows.map((row) => row.join(",")).join("\r\n")}\r\n`
  );

  const manifest = {
    generatedAt: generatedAt.toISOString(),
    backupDirectory,
    surveyCount: snapshot.surveyCount,
    responseCount: snapshot.responseCount,
    files: [jsonFile, combinedCsvFile, ...perSurveyCsvFiles],
  };

  const manifestFile = await writeBackupFile(
    path.join(backupDirectory, `survey-backup-manifest-${timestamp}.json`),
    `${JSON.stringify(manifest, null, 2)}\n`
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupDirectory,
        surveyCount: snapshot.surveyCount,
        responseCount: snapshot.responseCount,
        files: [jsonFile, combinedCsvFile, ...perSurveyCsvFiles, manifestFile].map((file) => ({
          path: file.path,
          sha256: file.sha256,
          bytes: file.bytes,
        })),
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
