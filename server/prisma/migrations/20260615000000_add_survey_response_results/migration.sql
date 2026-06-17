ALTER TABLE "SurveyResponse"
  ADD COLUMN "totalScore" INTEGER,
  ADD COLUMN "maxScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scorePercent" INTEGER,
  ADD COLUMN "riskLevel" "RiskLevel" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "instrument" TEXT,
  ADD COLUMN "scoredAt" TIMESTAMP(3);

