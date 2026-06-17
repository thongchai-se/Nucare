CREATE TYPE "SurveyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "SurveyQuestionType" AS ENUM (
  'TEXT',
  'TEXTAREA',
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'SCALE',
  'NUMBER',
  'DATE'
);

CREATE TABLE "Survey" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyQuestion" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "type" "SurveyQuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "description" TEXT,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL,
  "options" JSONB,
  "minValue" INTEGER,
  "maxValue" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SurveyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyResponse" (
  "id" TEXT NOT NULL,
  "surveyId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SurveyAnswer" (
  "id" TEXT NOT NULL,
  "responseId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SurveyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Survey_status_isActive_idx" ON "Survey"("status", "isActive");
CREATE INDEX "Survey_startsAt_endsAt_idx" ON "Survey"("startsAt", "endsAt");
CREATE INDEX "SurveyQuestion_surveyId_order_idx" ON "SurveyQuestion"("surveyId", "order");
CREATE UNIQUE INDEX "SurveyResponse_surveyId_studentId_key" ON "SurveyResponse"("surveyId", "studentId");
CREATE INDEX "SurveyResponse_surveyId_submittedAt_idx" ON "SurveyResponse"("surveyId", "submittedAt");
CREATE INDEX "SurveyResponse_studentId_submittedAt_idx" ON "SurveyResponse"("studentId", "submittedAt");
CREATE UNIQUE INDEX "SurveyAnswer_responseId_questionId_key" ON "SurveyAnswer"("responseId", "questionId");
CREATE INDEX "SurveyAnswer_questionId_idx" ON "SurveyAnswer"("questionId");

ALTER TABLE "Survey"
  ADD CONSTRAINT "Survey_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SurveyQuestion"
  ADD CONSTRAINT "SurveyQuestion_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "Survey"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyResponse"
  ADD CONSTRAINT "SurveyResponse_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "Survey"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyResponse"
  ADD CONSTRAINT "SurveyResponse_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyAnswer"
  ADD CONSTRAINT "SurveyAnswer_responseId_fkey"
  FOREIGN KEY ("responseId") REFERENCES "SurveyResponse"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyAnswer"
  ADD CONSTRAINT "SurveyAnswer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "SurveyQuestion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
