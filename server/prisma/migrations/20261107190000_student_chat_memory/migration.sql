-- CreateTable
CREATE TABLE "StudentChatMemory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "personaId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "lastTopic" TEXT,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentChatMemory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentChatMemory_studentId_updatedAt_idx" ON "StudentChatMemory"("studentId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentChatMemory_studentId_personaId_key" ON "StudentChatMemory"("studentId", "personaId");

-- AddForeignKey
ALTER TABLE "StudentChatMemory" ADD CONSTRAINT "StudentChatMemory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
