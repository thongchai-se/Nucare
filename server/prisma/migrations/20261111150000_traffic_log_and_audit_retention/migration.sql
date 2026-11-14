-- CreateTable
CREATE TABLE "TrafficLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "actorUserId" TEXT,
    "protocol" TEXT,

    CONSTRAINT "TrafficLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrafficLog_createdAt_idx" ON "TrafficLog"("createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_actorUserId_createdAt_idx" ON "TrafficLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_ipAddress_createdAt_idx" ON "TrafficLog"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "TrafficLog_path_createdAt_idx" ON "TrafficLog"("path", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
