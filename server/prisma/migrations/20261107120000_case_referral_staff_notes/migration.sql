-- AlterTable
ALTER TABLE "CaseReferral" ADD COLUMN IF NOT EXISTS "staffNote" TEXT;
ALTER TABLE "CaseReferral" ADD COLUMN IF NOT EXISTS "closedReason" TEXT;
