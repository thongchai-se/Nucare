-- CreateEnum
CREATE TYPE "WellnessTrendSignalCode" AS ENUM (
  'DEPRESSIVE_THEME',
  'ANXIETY_THEME',
  'ACADEMIC_STRESS',
  'SLEEP_DISTURBANCE',
  'LONELINESS_ISOLATION',
  'RELATIONSHIP_STRESS',
  'BURNOUT_FATIGUE',
  'SELF_HARM_CRISIS'
);

-- CreateTable
CREATE TABLE "StudentWellnessTrendSummary" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "signalCode" "WellnessTrendSignalCode" NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentWellnessTrendSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentWellnessTrendHit" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "signalCode" "WellnessTrendSignalCode" NOT NULL,
    "source" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentWellnessTrendHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentWellnessTrendSummary_studentId_lastDetectedAt_idx" ON "StudentWellnessTrendSummary"("studentId", "lastDetectedAt");

-- CreateIndex
CREATE INDEX "StudentWellnessTrendSummary_signalCode_lastDetectedAt_idx" ON "StudentWellnessTrendSummary"("signalCode", "lastDetectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentWellnessTrendSummary_studentId_signalCode_key" ON "StudentWellnessTrendSummary"("studentId", "signalCode");

-- CreateIndex
CREATE INDEX "StudentWellnessTrendHit_studentId_signalCode_detectedAt_idx" ON "StudentWellnessTrendHit"("studentId", "signalCode", "detectedAt");

-- CreateIndex
CREATE INDEX "StudentWellnessTrendHit_studentId_detectedAt_idx" ON "StudentWellnessTrendHit"("studentId", "detectedAt");

-- CreateIndex
CREATE INDEX "StudentWellnessTrendHit_source_detectedAt_idx" ON "StudentWellnessTrendHit"("source", "detectedAt");

-- AddForeignKey
ALTER TABLE "StudentWellnessTrendSummary" ADD CONSTRAINT "StudentWellnessTrendSummary_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentWellnessTrendHit" ADD CONSTRAINT "StudentWellnessTrendHit_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
