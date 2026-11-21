-- CreateTable
CREATE TABLE "MentalHealthScheduleOffer" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "note" TEXT,
    "status" "ConsultationOfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentalHealthScheduleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentalHealthScheduleOffer_referralId_status_createdAt_idx" ON "MentalHealthScheduleOffer"("referralId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MentalHealthScheduleOffer_proposedById_createdAt_idx" ON "MentalHealthScheduleOffer"("proposedById", "createdAt");

-- AddForeignKey
ALTER TABLE "MentalHealthScheduleOffer" ADD CONSTRAINT "MentalHealthScheduleOffer_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "CaseReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalHealthScheduleOffer" ADD CONSTRAINT "MentalHealthScheduleOffer_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
