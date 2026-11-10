-- CreateEnum
CREATE TYPE "SurveyFrequency" AS ENUM ('ONE_SHOT', 'WEEKLY', 'ACADEMIC_TERM');

-- CreateEnum
CREATE TYPE "SurveyAudienceType" AS ENUM ('ALL_STUDENTS', 'RULE_BASED');

-- CreateEnum
CREATE TYPE "SurveyWaveStatus" AS ENUM ('SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SurveyInstrumentCode" AS ENUM ('GHQ28', 'CUSTOM');

-- AlterTable Survey
ALTER TABLE "Survey"
  ADD COLUMN "frequency" "SurveyFrequency" NOT NULL DEFAULT 'ONE_SHOT',
  ADD COLUMN "audienceType" "SurveyAudienceType" NOT NULL DEFAULT 'ALL_STUDENTS',
  ADD COLUMN "instrumentCode" "SurveyInstrumentCode" NOT NULL DEFAULT 'CUSTOM';

UPDATE "Survey"
SET "instrumentCode" = 'GHQ28'
WHERE "title" ILIKE '%GHQ%' OR "title" ILIKE '%GHQ-28%' OR "title" ILIKE '%GHQ 28%' OR "title" LIKE '%แบบคัดกรองสุขภาพจิต%';

CREATE INDEX "Survey_audienceType_frequency_idx" ON "Survey"("audienceType", "frequency");

-- CreateTable SurveyEligibilityRule
CREATE TABLE "SurveyEligibilityRule" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "priorRiskLevels" "RiskLevel"[] DEFAULT ARRAY[]::"RiskLevel"[],
    "wellnessSignalCodes" "WellnessTrendSignalCode"[] DEFAULT ARRAY[]::"WellnessTrendSignalCode"[],
    "studyYears" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "sections" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyEligibilityRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SurveyEligibilityRule_surveyId_key" ON "SurveyEligibilityRule"("surveyId");

ALTER TABLE "SurveyEligibilityRule"
  ADD CONSTRAINT "SurveyEligibilityRule_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable SurveyWave
CREATE TABLE "SurveyWave" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "termKey" TEXT,
    "weekStart" TIMESTAMP(3),
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3),
    "status" "SurveyWaveStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyWave_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SurveyWave_surveyId_status_idx" ON "SurveyWave"("surveyId", "status");
CREATE INDEX "SurveyWave_opensAt_closesAt_idx" ON "SurveyWave"("opensAt", "closesAt");
CREATE INDEX "SurveyWave_status_opensAt_idx" ON "SurveyWave"("status", "opensAt");

ALTER TABLE "SurveyWave"
  ADD CONSTRAINT "SurveyWave_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one synthetic wave per existing survey
INSERT INTO "SurveyWave" ("id", "surveyId", "label", "termKey", "weekStart", "opensAt", "closesAt", "status", "createdAt", "updatedAt")
SELECT
  'wave_legacy_' || s."id",
  s."id",
  CASE
    WHEN s."isActive" THEN 'รอบเปิดปัจจุบัน'
    ELSE 'รอบย้อนหลัง'
  END,
  NULL,
  NULL,
  COALESCE(s."startsAt", s."createdAt"),
  s."endsAt",
  CASE
    WHEN s."isActive" THEN 'OPEN'::"SurveyWaveStatus"
    WHEN s."status" = 'ARCHIVED' THEN 'CLOSED'::"SurveyWaveStatus"
    ELSE 'CLOSED'::"SurveyWaveStatus"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Survey" s;

-- CreateTable SurveyAssignment
CREATE TABLE "SurveyAssignment" (
    "id" TEXT NOT NULL,
    "waveId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "eligibleAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SurveyAssignment_waveId_studentId_key" ON "SurveyAssignment"("waveId", "studentId");
CREATE INDEX "SurveyAssignment_studentId_completedAt_idx" ON "SurveyAssignment"("studentId", "completedAt");
CREATE INDEX "SurveyAssignment_waveId_completedAt_idx" ON "SurveyAssignment"("waveId", "completedAt");

ALTER TABLE "SurveyAssignment"
  ADD CONSTRAINT "SurveyAssignment_waveId_fkey"
  FOREIGN KEY ("waveId") REFERENCES "SurveyWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyAssignment"
  ADD CONSTRAINT "SurveyAssignment_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Alter SurveyResponse: add waveId nullable first, backfill, then require
ALTER TABLE "SurveyResponse" ADD COLUMN "waveId" TEXT;

UPDATE "SurveyResponse" r
SET "waveId" = 'wave_legacy_' || r."surveyId"
WHERE r."waveId" IS NULL;

-- Assignments for students who already submitted
INSERT INTO "SurveyAssignment" ("id", "waveId", "studentId", "eligibleAt", "completedAt", "createdAt", "updatedAt")
SELECT
  'assign_legacy_' || r."id",
  r."waveId",
  r."studentId",
  r."submittedAt",
  r."submittedAt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SurveyResponse" r
WHERE r."waveId" IS NOT NULL
ON CONFLICT ("waveId", "studentId") DO NOTHING;

ALTER TABLE "SurveyResponse" ALTER COLUMN "waveId" SET NOT NULL;

DROP INDEX IF EXISTS "SurveyResponse_surveyId_studentId_key";

CREATE UNIQUE INDEX "SurveyResponse_waveId_studentId_key" ON "SurveyResponse"("waveId", "studentId");
CREATE INDEX "SurveyResponse_waveId_submittedAt_idx" ON "SurveyResponse"("waveId", "submittedAt");

ALTER TABLE "SurveyResponse"
  ADD CONSTRAINT "SurveyResponse_waveId_fkey"
  FOREIGN KEY ("waveId") REFERENCES "SurveyWave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
