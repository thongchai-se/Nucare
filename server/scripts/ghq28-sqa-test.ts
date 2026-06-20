import { assertTestDatabaseUrl } from "./load-test-env";
import bcrypt from "bcryptjs";
import {
  Prisma,
  PrismaClient,
  Role,
  SurveyQuestionType,
  SurveyStatus,
} from "@prisma/client";
import {
  enrichSurveyResponseScores,
  getGhq28DistressLevel,
  GHQ28_MAX_SCORE,
  isGhq28SurveyTitle,
} from "../src/lib/survey-scoring";

const prisma = new PrismaClient();

type TestCaseResult = {
  id: string;
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
};

const results: TestCaseResult[] = [];

const record = (
  id: string,
  name: string,
  pass: boolean,
  expected: string,
  actual: string
): void => {
  results.push({ id, name, pass, expected, actual });
  const status = pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${id} ${name}`);
  if (!pass) {
    console.log(`  expected: ${expected}`);
    console.log(`  actual:   ${actual}`);
  }
};

const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const password = `SQA-${suffix}-Pass1`;
let adminUserId: string | null = null;
let studentUserId: string | null = null;
const createdUserIds: string[] = [];
let surveyId: string | null = null;
let scoredQuestionIds: string[] = [];

type QuestionRow = {
  id: string;
  type: SurveyQuestionType;
  options: Prisma.JsonValue | null;
  minValue: number | null;
  maxValue: number | null;
};

const getChoiceOptions = (question: QuestionRow): Array<{ value: string }> => {
  if (!Array.isArray(question.options)) {
    return [];
  }

  return question.options.flatMap((option) => {
    if (typeof option !== "object" || option === null || Array.isArray(option)) {
      return [];
    }

    const value = (option as Record<string, unknown>).value;
    return typeof value === "string" ? [{ value }] : [];
  });
};

const buildAnswers = (questions: QuestionRow[], choiceIndexes: number[]) =>
  questions.map((question, index) => {
    const options = getChoiceOptions(question);
    const choiceIndex = choiceIndexes[index] ?? 0;
    return {
      questionId: question.id,
      value: options[choiceIndex]?.value ?? options[0]?.value ?? "",
    };
  });

const cleanup = async (): Promise<void> => {
  if (surveyId) {
    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId },
      select: { id: true },
    });
    const responseIds = responses.map((response) => response.id);
    if (responseIds.length > 0) {
      await prisma.surveyAnswer.deleteMany({ where: { responseId: { in: responseIds } } });
      await prisma.surveyResponse.deleteMany({ where: { id: { in: responseIds } } });
    }
    await prisma.surveyQuestion.deleteMany({ where: { surveyId } });
    await prisma.survey.deleteMany({ where: { id: surveyId } });
  }

  const userIds = [...createdUserIds, adminUserId, studentUserId].filter(
    (id): id is string => Boolean(id)
  );
  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
};

const createGhq28Survey = async (): Promise<{ id: string; title: string; questions: QuestionRow[] }> => {
  const survey = await prisma.survey.create({
    data: {
      title: `SQA GHQ-28 ${suffix}`,
      description: "SQA test survey",
      status: SurveyStatus.PUBLISHED,
      isActive: true,
      questions: {
        create: Array.from({ length: 28 }, (_, index) => ({
          type: SurveyQuestionType.SINGLE_CHOICE,
          prompt: `SQA question ${index + 1}`,
          isRequired: true,
          order: index + 1,
          options: [
            { label: "ช่อง 1", score: 0, value: `sqa_q${index + 1}_1` },
            { label: "ช่อง 2", score: 1, value: `sqa_q${index + 1}_2` },
            { label: "ช่อง 3", score: 2, value: `sqa_q${index + 1}_3` },
            { label: "ช่อง 4", score: 3, value: `sqa_q${index + 1}_4` },
          ],
          minValue: null,
          maxValue: null,
        })),
      },
    },
    include: {
      questions: {
        orderBy: { order: "asc" },
      },
    },
  });

  return {
    id: survey.id,
    title: survey.title,
    questions: survey.questions,
  };
};

const submitSurveyResponse = async (
  studentId: string,
  surveyTitle: string,
  questions: QuestionRow[],
  choiceIndexes: number[]
) => {
  const answers = buildAnswers(questions, choiceIndexes);
  const scores = enrichSurveyResponseScores(surveyTitle, questions, answers);

  return prisma.surveyResponse.create({
    data: {
      surveyId: surveyId!,
      studentId,
      totalScore: scores.totalScore,
      maxScore: scores.maxScore,
      scorePercent: scores.scorePercent,
      riskLevel: scores.riskLevel,
      instrument: "GHQ-28",
      scoredAt: new Date(),
      answers: {
        create: answers.map((answer) => ({
          questionId: answer.questionId,
          value: answer.value,
        })),
      },
    },
  });
};

const main = async (): Promise<void> => {
  assertTestDatabaseUrl();

  const passwordHash = await bcrypt.hash(password, 10);
  const [admin, student] = await Promise.all([
    prisma.user.create({
      data: {
        name: "SQA Admin",
        email: `sqa-admin-${suffix}@nucare.test`,
        employeeId: `SQA${String(Date.now()).slice(-6)}`,
        role: Role.ADMIN,
        password: passwordHash,
        isActive: true,
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        name: "SQA Student",
        email: `sqa-student-${suffix}@nucare.test`,
        studentId: `8${String(Date.now()).slice(-8)}`,
        studyYear: 1,
        section: "SQA",
        role: Role.STUDENT,
        password: passwordHash,
        isActive: true,
      },
      select: { id: true },
    }),
  ]);
  adminUserId = admin.id;
  studentUserId = student.id;
  createdUserIds.push(admin.id, student.id);

  const survey = await createGhq28Survey();
  surveyId = survey.id;
  scoredQuestionIds = survey.questions.map((question) => question.id);

  const scoredQuestions = survey.questions.filter((question) => question.type === "SINGLE_CHOICE");
  const optionScores = scoredQuestions.flatMap((question) => {
    if (!Array.isArray(question.options)) {
      return [];
    }
    return question.options.map((option, index) => {
      const record = option as Record<string, unknown>;
      return typeof record.score === "number" ? record.score : index;
    });
  });

  record(
    "INT-01",
    "Seed GHQ-28 structure",
    isGhq28SurveyTitle(survey.title) &&
      scoredQuestions.length === 28 &&
      optionScores.every((score, index) => score === index % 4),
    "28 scored questions with option scores 0-3",
    `questions=${scoredQuestions.length}, scores=${optionScores.slice(0, 8).join(",")}...`
  );

  const normalIndexes = Array.from({ length: 28 }, () => 0);
  const normalResponse = await submitSurveyResponse(
    student.id,
    survey.title,
    survey.questions,
    normalIndexes
  );
  const normalDistress = getGhq28DistressLevel(normalResponse.totalScore);

  record(
    "INT-02",
    "Submit tier NORMAL",
    normalResponse.totalScore === 0 && normalDistress?.level === "NORMAL",
    "totalScore=0, distress=NORMAL",
    `totalScore=${normalResponse.totalScore}, distress=${normalDistress?.level}`
  );

  const mildIndexes = Array.from({ length: 28 }, (_, index) => (index < 20 ? 1 : 0));
  const mildStudent = await prisma.user.create({
    data: {
      name: "SQA Student Mild",
      email: `sqa-mild-${suffix}@nucare.test`,
      studentId: `9${String(Date.now()).slice(-8)}`,
      studyYear: 1,
      section: "SQA",
      role: Role.STUDENT,
      password: passwordHash,
      isActive: true,
    },
    select: { id: true },
  });
  createdUserIds.push(mildStudent.id);
  const mildResponse = await submitSurveyResponse(
    mildStudent.id,
    survey.title,
    survey.questions,
    mildIndexes
  );
  const mildDistress = getGhq28DistressLevel(mildResponse.totalScore);

  record(
    "INT-03",
    "Submit tier MILD",
    mildResponse.totalScore === 20 &&
      mildDistress?.level === "MILD" &&
      (mildResponse.totalScore ?? 0) >= 15 &&
      (mildResponse.totalScore ?? 0) <= 28,
    "totalScore=20, distress=MILD",
    `totalScore=${mildResponse.totalScore}, distress=${mildDistress?.level}`
  );

  const moderateIndexes = Array.from({ length: 28 }, (_, index) => {
    if (index < 7) return 3;
    if (index < 21) return 1;
    return 0;
  });
  const moderateStudent = await prisma.user.create({
    data: {
      name: "SQA Student Moderate",
      email: `sqa-mod-${suffix}@nucare.test`,
      studentId: `6${String(Date.now()).slice(-8)}`,
      studyYear: 1,
      section: "SQA",
      role: Role.STUDENT,
      password: passwordHash,
      isActive: true,
    },
    select: { id: true },
  });
  createdUserIds.push(moderateStudent.id);
  const moderateResponse = await submitSurveyResponse(
    moderateStudent.id,
    survey.title,
    survey.questions,
    moderateIndexes
  );
  const moderateDistress = getGhq28DistressLevel(moderateResponse.totalScore);

  record(
    "INT-04",
    "Submit tier MODERATE",
    moderateResponse.totalScore === 35 && moderateDistress?.level === "MODERATE",
    "totalScore=35, distress=MODERATE",
    `totalScore=${moderateResponse.totalScore}, distress=${moderateDistress?.level}`
  );

  const severeIndexes = Array.from({ length: 28 }, () => 3);
  const severeStudent = await prisma.user.create({
    data: {
      name: "SQA Student Severe",
      email: `sqa-sev-${suffix}@nucare.test`,
      studentId: `5${String(Date.now()).slice(-8)}`,
      studyYear: 1,
      section: "SQA",
      role: Role.STUDENT,
      password: passwordHash,
      isActive: true,
    },
    select: { id: true },
  });
  createdUserIds.push(severeStudent.id);
  const severeResponse = await submitSurveyResponse(
    severeStudent.id,
    survey.title,
    survey.questions,
    severeIndexes
  );
  const severeDistress = getGhq28DistressLevel(severeResponse.totalScore);

  record(
    "INT-05",
    "Submit tier SEVERE",
    severeResponse.totalScore === GHQ28_MAX_SCORE && severeDistress?.level === "SEVERE",
    `totalScore=${GHQ28_MAX_SCORE}, distress=SEVERE`,
    `totalScore=${severeResponse.totalScore}, distress=${severeDistress?.level}`
  );

  let duplicateErrorCode = "";
  try {
    await submitSurveyResponse(student.id, survey.title, survey.questions, normalIndexes);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      duplicateErrorCode = error.code;
    }
  }

  record(
    "INT-06",
    "Duplicate submit blocked",
    duplicateErrorCode === "P2002",
    "P2002 unique constraint",
    duplicateErrorCode || "no error"
  );

  const storedResponses = await prisma.surveyResponse.findMany({
    where: { surveyId: survey.id },
    include: { answers: true },
  });
  const listChecks = storedResponses.every((response) => {
    const scores = enrichSurveyResponseScores(survey.title, survey.questions, response.answers);
    return scores.distressLevel !== null && scores.distressLabel !== null;
  });

  record(
    "INT-07",
    "Admin distress labels available",
    storedResponses.length >= 4 && listChecks,
    "all responses have distressLevel/label",
    `responses=${storedResponses.length}, allLabeled=${listChecks}`
  );

  const archived = await prisma.survey.update({
    where: { id: survey.id },
    data: { status: SurveyStatus.ARCHIVED, isActive: false },
  });

  record(
    "INT-08",
    "Archive survey",
    archived.status === "ARCHIVED" && archived.isActive === false,
    "ARCHIVED + isActive=false",
    `status=${archived.status}, isActive=${archived.isActive}`
  );

  const restored = await prisma.survey.update({
    where: { id: survey.id },
    data: { status: SurveyStatus.DRAFT, isActive: false },
  });

  record(
    "INT-09",
    "Restore survey",
    restored.status === "DRAFT",
    "status=DRAFT",
    `status=${restored.status}`
  );

  for (const question of survey.questions) {
    if (question.type !== SurveyQuestionType.SINGLE_CHOICE || !Array.isArray(question.options)) {
      continue;
    }

    await prisma.surveyQuestion.update({
      where: { id: question.id },
      data: {
        options: question.options.map((option, index) => {
          if (typeof option !== "object" || option === null || Array.isArray(option)) {
            return option;
          }
          return { ...(option as Record<string, unknown>), score: index };
        }) as Prisma.InputJsonValue,
      },
    });
  }

  let recalculatedCount = 0;
  for (const response of storedResponses) {
    const scores = enrichSurveyResponseScores(survey.title, survey.questions, response.answers);
    await prisma.surveyResponse.update({
      where: { id: response.id },
      data: {
        totalScore: scores.totalScore,
        maxScore: scores.maxScore,
        scorePercent: scores.scorePercent,
        riskLevel: scores.riskLevel,
      },
    });
    recalculatedCount += 1;
  }

  const recalculatedNormal = await prisma.surveyResponse.findUnique({
    where: { id: normalResponse.id },
  });

  record(
    "INT-10",
    "Recalculate scores",
    recalculatedCount === storedResponses.length && recalculatedNormal?.maxScore === GHQ28_MAX_SCORE,
    `recalculated=${storedResponses.length}, maxScore=${GHQ28_MAX_SCORE}`,
    `recalculated=${recalculatedCount}, maxScore=${recalculatedNormal?.maxScore}`
  );

  const emptySurvey = await prisma.survey.create({
    data: {
      title: `SQA Empty ${suffix}`,
      description: "delete test",
      status: SurveyStatus.DRAFT,
      isActive: false,
    },
  });
  await prisma.survey.delete({ where: { id: emptySurvey.id } });
  const deletedEmpty = await prisma.survey.findUnique({ where: { id: emptySurvey.id } });

  record(
    "INT-11",
    "Delete survey without responses",
    deletedEmpty === null,
    "survey removed",
    deletedEmpty ? "still exists" : "removed"
  );

  const responseIds = storedResponses.map((response) => response.id);
  await prisma.surveyAnswer.deleteMany({ where: { responseId: { in: responseIds } } });
  await prisma.surveyResponse.deleteMany({ where: { id: { in: responseIds } } });
  await prisma.surveyQuestion.deleteMany({ where: { surveyId: survey.id } });
  await prisma.survey.delete({ where: { id: survey.id } });
  const deletedWithResponses = await prisma.survey.findUnique({ where: { id: survey.id } });
  surveyId = null;

  record(
    "INT-12",
    "Delete survey with responses (cascade manual)",
    deletedWithResponses === null,
    "survey and responses removed",
    deletedWithResponses ? "still exists" : "removed"
  );

  const failed = results.filter((result) => !result.pass);
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        passed: results.filter((result) => result.pass).length,
        failed: failed.length,
        total: results.length,
        results,
      },
      null,
      2
    )
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

main()
  .catch(async (error) => {
    console.error("GHQ-28 SQA test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (cleanupError) {
      console.error("Cleanup failed:", cleanupError);
    }
    await prisma.$disconnect();
  });
