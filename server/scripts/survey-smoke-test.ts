import "../src/lib/env";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const apiBaseUrl = process.env.SURVEY_SMOKE_API_BASE_URL || "http://localhost:5000";
const allowActiveSurveyInterruption = process.env.SURVEY_SMOKE_ALLOW_ACTIVE_INTERRUPTION === "1";
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const password = `Smoke-${suffix}-Pass1`;
const adminEmail = `survey-admin-${suffix}@nucare.test`;
const studentEmail = `survey-student-${suffix}@nucare.test`;
const studentId = `7${String(Date.now()).slice(-8)}-${Math.floor(Math.random() * 10)}`;

let adminUserId: string | null = null;
let studentUserId: string | null = null;
let surveyId: string | null = null;

type SmokeQuestion = {
  id: string;
  type: string;
  prompt: string;
  description: string | null;
  isRequired: boolean;
  order: number;
  options: Array<{ label: string; value: string }>;
  minValue: number | null;
  maxValue: number | null;
};

const getSetCookies = (headers: Headers): string[] => {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") {
    return getSetCookie.call(headers);
  }

  const combined = headers.get("set-cookie");
  return combined ? combined.split(/,(?=\s*[^;,]+=)/) : [];
};

const login = async (identifier: string): Promise<string> => {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed for ${identifier}: ${response.status} ${await response.text()}`);
  }

  const cookieHeader = getSetCookies(response.headers)
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");

  if (!cookieHeader.includes("accessToken=")) {
    throw new Error(`Login for ${identifier} did not return an accessToken cookie`);
  }

  return cookieHeader;
};

const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${text}`);
  }

  return body as T;
};

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

  const userIds = [adminUserId, studentUserId].filter((id): id is string => Boolean(id));
  if (userIds.length > 0) {
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
};

const main = async (): Promise<void> => {
  const activeSurveyCount = await prisma.survey.count({
    where: {
      status: "PUBLISHED",
      isActive: true,
    },
  });

  if (activeSurveyCount > 0 && !allowActiveSurveyInterruption) {
    throw new Error(
      "Refusing to run survey smoke test while an active survey exists. Set SURVEY_SMOKE_ALLOW_ACTIVE_INTERRUPTION=1 only outside collection windows."
    );
  }

  const healthResponse = await fetch(`${apiBaseUrl}/api/health`);
  if (!healthResponse.ok) {
    throw new Error(`API health check failed: ${healthResponse.status}`);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [admin, student] = await Promise.all([
    prisma.user.create({
      data: {
        name: "Survey Smoke Admin",
        email: adminEmail,
        employeeId: `SADM${String(Date.now()).slice(-6)}`,
        role: Role.ADMIN,
        password: passwordHash,
        isActive: true,
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        name: "Survey Smoke Student",
        email: studentEmail,
        studentId,
        studyYear: 1,
        section: "SMOKE",
        role: Role.STUDENT,
        password: passwordHash,
        isActive: true,
      },
      select: { id: true },
    }),
  ]);
  adminUserId = admin.id;
  studentUserId = student.id;

  const adminCookie = await login(adminEmail);
  const createdSurvey = await apiRequest<{
    survey: {
      id: string;
      title: string;
      description: string | null;
      questions: SmokeQuestion[];
    };
  }>("/api/admin/surveys", {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: JSON.stringify({
      title: `Smoke Orientation Survey ${suffix}`,
      description: "Temporary smoke test survey",
      status: "PUBLISHED",
      isActive: true,
      startsAt: null,
      endsAt: null,
      questions: [
        {
          type: "SINGLE_CHOICE",
          prompt: "Will you attend orientation?",
          isRequired: true,
          order: 1,
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
        {
          type: "MULTIPLE_CHOICE",
          prompt: "Preferred contact channels",
          isRequired: true,
          order: 2,
          options: [
            { label: "Phone", value: "phone" },
            { label: "LINE", value: "line" },
            { label: "Email", value: "email" },
          ],
        },
        {
          type: "SCALE",
          prompt: "Readiness level",
          isRequired: true,
          order: 3,
          minValue: 1,
          maxValue: 5,
        },
        {
          type: "NUMBER",
          prompt: "Expected club count",
          isRequired: true,
          order: 4,
          minValue: 0,
          maxValue: 10,
        },
        {
          type: "DATE",
          prompt: "Orientation date",
          isRequired: true,
          order: 5,
        },
        {
          type: "TEXT",
          prompt: "Nickname",
          isRequired: true,
          order: 6,
        },
        {
          type: "TEXTAREA",
          prompt: "Notes",
          isRequired: false,
          order: 7,
        },
      ],
    }),
  });
  surveyId = createdSurvey.survey.id;
  const questions = createdSurvey.survey.questions;
  const questionIds = questions.map((question) => question.id);

  const studentCookie = await login(studentEmail);
  const activeSurvey = await apiRequest<{
    survey: { id: string } | null;
    hasSubmitted: boolean;
  }>("/api/student/surveys/active", {
    headers: { Cookie: studentCookie },
  });

  if (activeSurvey.survey?.id !== surveyId || activeSurvey.hasSubmitted) {
    throw new Error("Student active survey payload did not match the smoke survey");
  }

  const invalidSubmission = await fetch(`${apiBaseUrl}/api/student/surveys/${surveyId}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({
      answers: [{ questionId: questionIds[0], value: "yes" }],
    }),
  });

  if (invalidSubmission.status !== 400) {
    throw new Error(`Incomplete required-answer guard failed; expected 400, got ${invalidSubmission.status}`);
  }

  const submitted = await apiRequest<{ response: { id: string } }>(
    `/api/student/surveys/${surveyId}/responses`,
    {
      method: "POST",
      headers: { Cookie: studentCookie },
      body: JSON.stringify({
        answers: [
          { questionId: questionIds[0], value: "yes" },
          { questionId: questionIds[1], value: ["line", "email"] },
          { questionId: questionIds[2], value: 4 },
          { questionId: questionIds[3], value: 2.5 },
          { questionId: questionIds[4], value: "2026-06-20" },
          { questionId: questionIds[5], value: "Smoke" },
          { questionId: questionIds[6], value: "ready" },
        ],
      }),
    }
  );

  const responses = await apiRequest<{ responses: Array<{ id: string }> }>(
    `/api/admin/surveys/${surveyId}/responses`,
    {
      headers: { Cookie: adminCookie },
    }
  );

  if (responses.responses.length !== 1 || responses.responses[0].id !== submitted.response.id) {
    throw new Error("Admin responses endpoint did not return the submitted response");
  }

  const duplicateResponse = await fetch(`${apiBaseUrl}/api/student/surveys/${surveyId}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: studentCookie,
    },
    body: JSON.stringify({
      answers: [{ questionId: questionIds[0], value: "yes" }],
    }),
  });

  if (duplicateResponse.status !== 409) {
    throw new Error(`Duplicate submission guard failed; expected 409, got ${duplicateResponse.status}`);
  }

  const protectedUpdate = await fetch(`${apiBaseUrl}/api/admin/surveys/${surveyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      title: createdSurvey.survey.title,
      description: createdSurvey.survey.description,
      status: "PUBLISHED",
      isActive: true,
      startsAt: null,
      endsAt: null,
      questions: questions.slice(0, -1).map((question, index) => ({
        id: question.id,
        type: question.type,
        prompt: question.prompt,
        description: question.description,
        isRequired: question.isRequired,
        order: index + 1,
        options:
          question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE"
            ? question.options
            : undefined,
        minValue:
          question.type === "SCALE" || question.type === "NUMBER" ? question.minValue : null,
        maxValue:
          question.type === "SCALE" || question.type === "NUMBER" ? question.maxValue : null,
      })),
    }),
  });

  if (protectedUpdate.status !== 409) {
    throw new Error(`Survey response protection failed on question removal; expected 409, got ${protectedUpdate.status}`);
  }

  const protectedDelete = await fetch(`${apiBaseUrl}/api/admin/surveys/${surveyId}`, {
    method: "DELETE",
    headers: {
      Cookie: adminCookie,
    },
  });

  if (protectedDelete.status !== 409) {
    throw new Error(`Survey response protection failed on delete; expected 409, got ${protectedDelete.status}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiHealth: true,
        adminCanCreateSurvey: true,
        allQuestionTypesAccepted: true,
        studentCanSeeActiveSurvey: true,
        incompleteRequiredSubmissionRejected: true,
        studentCanSubmitResponse: true,
        adminCanReadResponse: true,
        duplicateSubmissionBlocked: true,
        surveyWithResponsesProtectedFromQuestionRemoval: true,
        surveyWithResponsesProtectedFromDelete: true,
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
  .finally(cleanup)
  .finally(async () => {
    await prisma.$disconnect();
  });
