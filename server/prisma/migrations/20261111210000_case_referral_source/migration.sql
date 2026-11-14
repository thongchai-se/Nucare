-- Phase E: ต้นทางของ CaseReferral จากคิวทบทวนผลคัดกรอง (additive only)

-- AlterTable
ALTER TABLE "CaseReferral" ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" TEXT;

-- CreateIndex
CREATE INDEX "CaseReferral_sourceType_sourceId_idx" ON "CaseReferral"("sourceType", "sourceId");
