-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AlertPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."AlertType" AS ENUM ('ADVISOR_FOLLOW_UP', 'BEHAVIOR_REPORTED', 'REFERRAL_RECEIVED', 'HIGH_RISK_SCREENING', 'SOS_OPENED');

-- CreateEnum
CREATE TYPE "public"."AssessmentInstrument" AS ENUM ('Q2', 'ST5', 'Q9', 'Q8');

-- CreateEnum
CREATE TYPE "public"."BehaviorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."ConsultationPreferredChannel" AS ENUM ('IN_PERSON', 'ONLINE', 'PHONE', 'MESSAGE');

-- CreateEnum
CREATE TYPE "public"."ConsultationRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'SCHEDULED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."EmergencyCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."ReferralStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."ReferralTarget" AS ENUM ('STUDENT_DEVELOPMENT', 'COUNSELING_CENTER');

-- CreateEnum
CREATE TYPE "public"."RiskLevel" AS ENUM ('NORMAL', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('STUDENT', 'ADVISOR', 'STUDENT_DEVELOPMENT', 'MENTAL_HEALTH', 'INSTRUCTOR', 'EXECUTIVE', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."Alert" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "studentId" TEXT,
    "type" "public"."AlertType" NOT NULL,
    "priority" "public"."AlertPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "public"."AlertStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionCode" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerValue" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BehaviorRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "severity" "public"."BehaviorSeverity" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BehaviorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CareRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "careDate" TIMESTAMP(3) NOT NULL,
    "careType" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CaseReferral" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "target" "public"."ReferralTarget" NOT NULL,
    "reason" TEXT NOT NULL,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConsultationRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "alertId" TEXT,
    "topic" TEXT NOT NULL,
    "preferredChannel" "public"."ConsultationPreferredChannel" NOT NULL DEFAULT 'IN_PERSON',
    "note" TEXT,
    "status" "public"."ConsultationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "advisorNote" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmergencyCase" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reportedByUserId" TEXT,
    "summary" TEXT NOT NULL,
    "status" "public"."EmergencyCaseStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SpecializedCareRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "mentalHealthUserId" TEXT NOT NULL,
    "referralId" TEXT,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "interventionPlan" TEXT NOT NULL,
    "confidentialNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecializedCareRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudentAdvisorAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAdvisorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StudentAssessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instrument" "public"."AssessmentInstrument" NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "riskLevel" "public"."RiskLevel" NOT NULL DEFAULT 'NORMAL',
    "assessedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "studentId" TEXT,
    "employeeId" TEXT,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" "public"."Role" NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "section" TEXT,
    "studyYear" INTEGER,
    "additionalRoles" "public"."Role"[] DEFAULT ARRAY[]::"public"."Role"[],

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_recipientUserId_status_createdAt_idx" ON "public"."Alert"("recipientUserId" ASC, "status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Alert_studentId_createdAt_idx" ON "public"."Alert"("studentId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AssessmentAnswer_assessmentId_idx" ON "public"."AssessmentAnswer"("assessmentId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "public"."AuditLog"("actorUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_createdAt_idx" ON "public"."AuditLog"("entityType" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "BehaviorRecord_instructorId_createdAt_idx" ON "public"."BehaviorRecord"("instructorId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "BehaviorRecord_studentId_observedAt_idx" ON "public"."BehaviorRecord"("studentId" ASC, "observedAt" ASC);

-- CreateIndex
CREATE INDEX "CareRecord_advisorId_createdAt_idx" ON "public"."CareRecord"("advisorId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "CareRecord_studentId_careDate_idx" ON "public"."CareRecord"("studentId" ASC, "careDate" ASC);

-- CreateIndex
CREATE INDEX "CaseReferral_advisorId_createdAt_idx" ON "public"."CaseReferral"("advisorId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "CaseReferral_status_createdAt_idx" ON "public"."CaseReferral"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "CaseReferral_studentId_createdAt_idx" ON "public"."CaseReferral"("studentId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRequest_alertId_key" ON "public"."ConsultationRequest"("alertId" ASC);

-- CreateIndex
CREATE INDEX "ConsultationRequest_status_createdAt_idx" ON "public"."ConsultationRequest"("status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ConsultationRequest_studentId_createdAt_idx" ON "public"."ConsultationRequest"("studentId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ConsultationRequest_teacherId_status_createdAt_idx" ON "public"."ConsultationRequest"("teacherId" ASC, "status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "EmergencyCase_status_openedAt_idx" ON "public"."EmergencyCase"("status" ASC, "openedAt" ASC);

-- CreateIndex
CREATE INDEX "EmergencyCase_studentId_createdAt_idx" ON "public"."EmergencyCase"("studentId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "public"."PasswordResetToken"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "public"."PasswordResetToken"("tokenHash" ASC);

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "public"."PasswordResetToken"("userId" ASC);

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "public"."RefreshToken"("expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "public"."RefreshToken"("token" ASC);

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "public"."RefreshToken"("userId" ASC);

-- CreateIndex
CREATE INDEX "SpecializedCareRecord_mentalHealthUserId_createdAt_idx" ON "public"."SpecializedCareRecord"("mentalHealthUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "SpecializedCareRecord_studentId_sessionDate_idx" ON "public"."SpecializedCareRecord"("studentId" ASC, "sessionDate" ASC);

-- CreateIndex
CREATE INDEX "StudentAdvisorAssignment_advisorId_isActive_idx" ON "public"."StudentAdvisorAssignment"("advisorId" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "StudentAdvisorAssignment_studentId_isActive_idx" ON "public"."StudentAdvisorAssignment"("studentId" ASC, "isActive" ASC);

-- CreateIndex
CREATE INDEX "StudentAssessment_studentId_assessedAt_idx" ON "public"."StudentAssessment"("studentId" ASC, "assessedAt" ASC);

-- CreateIndex
CREATE INDEX "StudentAssessment_studentId_instrument_assessedAt_idx" ON "public"."StudentAssessment"("studentId" ASC, "instrument" ASC, "assessedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "public"."User"("employeeId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "public"."User"("studentId" ASC);

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Alert" ADD CONSTRAINT "Alert_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "public"."StudentAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BehaviorRecord" ADD CONSTRAINT "BehaviorRecord_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BehaviorRecord" ADD CONSTRAINT "BehaviorRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CareRecord" ADD CONSTRAINT "CareRecord_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CareRecord" ADD CONSTRAINT "CareRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CaseReferral" ADD CONSTRAINT "CaseReferral_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CaseReferral" ADD CONSTRAINT "CaseReferral_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "public"."Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConsultationRequest" ADD CONSTRAINT "ConsultationRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmergencyCase" ADD CONSTRAINT "EmergencyCase_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmergencyCase" ADD CONSTRAINT "EmergencyCase_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecializedCareRecord" ADD CONSTRAINT "SpecializedCareRecord_mentalHealthUserId_fkey" FOREIGN KEY ("mentalHealthUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecializedCareRecord" ADD CONSTRAINT "SpecializedCareRecord_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "public"."CaseReferral"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SpecializedCareRecord" ADD CONSTRAINT "SpecializedCareRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentAdvisorAssignment" ADD CONSTRAINT "StudentAdvisorAssignment_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentAdvisorAssignment" ADD CONSTRAINT "StudentAdvisorAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StudentAssessment" ADD CONSTRAINT "StudentAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
