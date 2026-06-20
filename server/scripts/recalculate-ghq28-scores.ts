import "../src/lib/env";
import { Prisma, SurveyQuestionType } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  enrichSurveyResponseScores,
  isGhq28SurveyTitle,
} from "../src/lib/survey-scoring";

const normalizeGhq28Options = (options: Prisma.JsonValue | null): Prisma.InputJsonValue | null => {
  if (!Array.isArray(options)) {
    return options as Prisma.InputJsonValue | null;
  }

  return options.map((option, index) => {
    if (typeof option !== "object" || option === null || Array.isArray(option)) {
      return option;
    }

    const record = option as Record<string, unknown>;
    return {
      ...record,
      score: index,
    };
  }) as Prisma.InputJsonValue;
};

const findGhq28Survey = async () => {
  const configuredSurveyId = process.env.GHQ28_SURVEY_ID?.trim();
  if (configuredSurveyId) {
    return prisma.survey.findUnique({
      where: { id: configuredSurveyId },
      include: {
        questions: { orderBy: { order: "asc" } },
        responses: { include: { answers: true } },
      },
    });
  }

  return prisma.survey.findFirst({
    where: {
      OR: [
        { title: { contains: "GHQ-28" } },
        { title: { contains: "แบบทดสอบสุขภาพทั่วไป" } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      questions: { orderBy: { order: "asc" } },
      responses: { include: { answers: true } },
    },
  });
};

const main = async (): Promise<void> => {
  const survey = await findGhq28Survey();

  if (!survey) {
    console.log(JSON.stringify({ ok: false, message: "GHQ-28 survey not found" }, null, 2));
    return;
  }

  if (!isGhq28SurveyTitle(survey.title)) {
    console.log(JSON.stringify({ ok: false, message: "Survey title is not GHQ-28" }, null, 2));
    return;
  }

  let updatedQuestions = 0;

  for (const question of survey.questions) {
    if (question.type !== SurveyQuestionType.SINGLE_CHOICE || !Array.isArray(question.options)) {
      continue;
    }

    const normalizedOptions = normalizeGhq28Options(question.options);
    await prisma.surveyQuestion.update({
      where: { id: question.id },
      data: { options: normalizedOptions },
    });
    updatedQuestions += 1;
  }

  let updatedResponses = 0;

  for (const response of survey.responses) {
    const scores = enrichSurveyResponseScores(survey.title, survey.questions, response.answers);

    await prisma.surveyResponse.update({
      where: { id: response.id },
      data: {
        totalScore: scores.totalScore,
        maxScore: scores.maxScore,
        scorePercent: scores.scorePercent,
        riskLevel: scores.riskLevel,
        scoredAt: response.scoredAt ?? response.submittedAt,
      },
    });
    updatedResponses += 1;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        survey: {
          id: survey.id,
          title: survey.title,
        },
        updatedQuestions,
        updatedResponses,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error("Failed to recalculate GHQ-28 scores:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
