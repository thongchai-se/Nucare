-- Phase B: Survey versioning (additive only — ไม่ลบ/ไม่แก้ข้อมูลเดิม)

-- CreateEnum
CREATE TYPE "SurveyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "SurveyVersion" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "SurveyVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instrumentCode" "SurveyInstrumentCode" NOT NULL DEFAULT 'CUSTOM',
    "scoringRulesJson" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurveyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyVersionQuestion" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceQuestionId" TEXT,
    "type" "SurveyQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "options" JSONB,
    "minValue" INTEGER,
    "maxValue" INTEGER,

    CONSTRAINT "SurveyVersionQuestion_pkey" PRIMARY KEY ("id")
);

-- AlterTable (คอลัมน์ใหม่ทั้งหมด nullable)
ALTER TABLE "SurveyWave" ADD COLUMN "versionId" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN "versionId" TEXT;
ALTER TABLE "SurveyResponse" ADD COLUMN "scoringSnapshot" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "SurveyVersion_surveyId_version_key" ON "SurveyVersion"("surveyId", "version");
CREATE INDEX "SurveyVersion_surveyId_status_idx" ON "SurveyVersion"("surveyId", "status");
CREATE INDEX "SurveyVersionQuestion_versionId_order_idx" ON "SurveyVersionQuestion"("versionId", "order");
CREATE INDEX "SurveyWave_versionId_idx" ON "SurveyWave"("versionId");
CREATE INDEX "SurveyResponse_versionId_idx" ON "SurveyResponse"("versionId");

-- AddForeignKey
ALTER TABLE "SurveyVersion"
  ADD CONSTRAINT "SurveyVersion_surveyId_fkey"
  FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyVersionQuestion"
  ADD CONSTRAINT "SurveyVersionQuestion_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "SurveyVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SurveyWave"
  ADD CONSTRAINT "SurveyWave_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "SurveyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SurveyResponse"
  ADD CONSTRAINT "SurveyResponse_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "SurveyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: v1 PUBLISHED ให้ทุก Survey เดิม (id กำหนดแน่นอนจาก surveyId เพื่อให้รันซ้ำได้ปลอดภัย)
INSERT INTO "SurveyVersion" (
  "id", "surveyId", "version", "status", "title", "description", "instrumentCode",
  "scoringRulesJson", "publishedAt", "createdById", "createdAt", "updatedAt"
)
SELECT
  'sv1_' || s."id",
  s."id",
  1,
  'PUBLISHED'::"SurveyVersionStatus",
  s."title",
  s."description",
  s."instrumentCode",
  NULL,
  CURRENT_TIMESTAMP,
  s."createdById",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Survey" s
ON CONFLICT ("surveyId", "version") DO NOTHING;

-- Backfill: snapshot คำถามปัจจุบันเข้า v1
INSERT INTO "SurveyVersionQuestion" (
  "id", "versionId", "sourceQuestionId", "type", "prompt", "description",
  "isRequired", "order", "options", "minValue", "maxValue"
)
SELECT
  'svq1_' || q."id",
  'sv1_' || q."surveyId",
  q."id",
  q."type",
  q."prompt",
  q."description",
  q."isRequired",
  q."order",
  q."options",
  q."minValue",
  q."maxValue"
FROM "SurveyQuestion" q
WHERE EXISTS (SELECT 1 FROM "SurveyVersion" v WHERE v."id" = 'sv1_' || q."surveyId")
  AND NOT EXISTS (SELECT 1 FROM "SurveyVersionQuestion" x WHERE x."id" = 'svq1_' || q."id");

-- Backfill: ผูกคลื่นและคำตอบเดิมกับ v1 (เฉพาะแถวที่ยังไม่มี versionId)
UPDATE "SurveyWave" w
SET "versionId" = 'sv1_' || w."surveyId"
WHERE w."versionId" IS NULL
  AND EXISTS (SELECT 1 FROM "SurveyVersion" v WHERE v."id" = 'sv1_' || w."surveyId");

UPDATE "SurveyResponse" r
SET "versionId" = 'sv1_' || r."surveyId"
WHERE r."versionId" IS NULL
  AND EXISTS (SELECT 1 FROM "SurveyVersion" v WHERE v."id" = 'sv1_' || r."surveyId");
