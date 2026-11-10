-- CreateEnum
CREATE TYPE "MentalHealthAppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "MentalHealthAppointment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mentalHealthUserId" TEXT NOT NULL,
    "referralId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "note" TEXT,
    "status" "MentalHealthAppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentalHealthAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentalHealthAppointment_studentId_scheduledAt_idx" ON "MentalHealthAppointment"("studentId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MentalHealthAppointment_mentalHealthUserId_scheduledAt_idx" ON "MentalHealthAppointment"("mentalHealthUserId", "scheduledAt");

-- CreateIndex
CREATE INDEX "MentalHealthAppointment_status_scheduledAt_idx" ON "MentalHealthAppointment"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MentalHealthAppointment_referralId_idx" ON "MentalHealthAppointment"("referralId");

-- AddForeignKey
ALTER TABLE "MentalHealthAppointment" ADD CONSTRAINT "MentalHealthAppointment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalHealthAppointment" ADD CONSTRAINT "MentalHealthAppointment_mentalHealthUserId_fkey" FOREIGN KEY ("mentalHealthUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentalHealthAppointment" ADD CONSTRAINT "MentalHealthAppointment_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "CaseReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;
