-- CreateEnum
CREATE TYPE "ConsultationOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'SUPERSEDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "ConsultationRequest" ADD COLUMN "scheduleLocation" TEXT;

-- CreateTable
CREATE TABLE "ConsultationScheduleOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "note" TEXT,
    "status" "ConsultationOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationScheduleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationScheduleOffer_requestId_status_createdAt_idx" ON "ConsultationScheduleOffer"("requestId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationScheduleOffer_proposedById_createdAt_idx" ON "ConsultationScheduleOffer"("proposedById", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultationScheduleOffer" ADD CONSTRAINT "ConsultationScheduleOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ConsultationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationScheduleOffer" ADD CONSTRAINT "ConsultationScheduleOffer_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
