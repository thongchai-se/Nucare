-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE 'CHAT_MESSAGE';

-- CreateEnum
CREATE TYPE "EphemeralChatSessionStatus" AS ENUM ('ACTIVE');

-- CreateTable
CREATE TABLE "EphemeralChatSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "EphemeralChatSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "consultationRequestId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EphemeralChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EphemeralChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EphemeralChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EphemeralChatSession_consultationRequestId_key" ON "EphemeralChatSession"("consultationRequestId");

-- CreateIndex
CREATE INDEX "EphemeralChatSession_staffId_lastMessageAt_idx" ON "EphemeralChatSession"("staffId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "EphemeralChatSession_studentId_lastMessageAt_idx" ON "EphemeralChatSession"("studentId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "EphemeralChatSession_status_lastMessageAt_idx" ON "EphemeralChatSession"("status", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "EphemeralChatSession_studentId_staffId_key" ON "EphemeralChatSession"("studentId", "staffId");

-- CreateIndex
CREATE INDEX "EphemeralChatMessage_sessionId_createdAt_idx" ON "EphemeralChatMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "EphemeralChatMessage_senderId_createdAt_idx" ON "EphemeralChatMessage"("senderId", "createdAt");

-- AddForeignKey
ALTER TABLE "EphemeralChatSession" ADD CONSTRAINT "EphemeralChatSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EphemeralChatSession" ADD CONSTRAINT "EphemeralChatSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EphemeralChatSession" ADD CONSTRAINT "EphemeralChatSession_consultationRequestId_fkey" FOREIGN KEY ("consultationRequestId") REFERENCES "ConsultationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EphemeralChatMessage" ADD CONSTRAINT "EphemeralChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EphemeralChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EphemeralChatMessage" ADD CONSTRAINT "EphemeralChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
