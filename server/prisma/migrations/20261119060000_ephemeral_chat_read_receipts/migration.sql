-- AlterTable
ALTER TABLE "EphemeralChatSession" ADD COLUMN "studentLastReadAt" TIMESTAMP(3);
ALTER TABLE "EphemeralChatSession" ADD COLUMN "staffLastReadAt" TIMESTAMP(3);
