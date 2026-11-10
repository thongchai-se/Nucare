-- CreateTable
CREATE TABLE "StudentInstructorAssignment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentInstructorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "anonymousId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "analytics" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentInstructorAssignment_studentId_instructorId_key" ON "StudentInstructorAssignment"("studentId", "instructorId");

-- CreateIndex
CREATE INDEX "StudentInstructorAssignment_instructorId_isActive_idx" ON "StudentInstructorAssignment"("instructorId", "isActive");

-- CreateIndex
CREATE INDEX "StudentInstructorAssignment_studentId_isActive_idx" ON "StudentInstructorAssignment"("studentId", "isActive");

-- CreateIndex
CREATE INDEX "ConsentRecord_anonymousId_createdAt_idx" ON "ConsentRecord"("anonymousId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_createdAt_idx" ON "ConsentRecord"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentInstructorAssignment" ADD CONSTRAINT "StudentInstructorAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentInstructorAssignment" ADD CONSTRAINT "StudentInstructorAssignment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep existing instructor access only for students they already recorded.
INSERT INTO "StudentInstructorAssignment" (
    "id",
    "studentId",
    "instructorId",
    "assignedAt",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'sia_' || substr(md5("instructorId" || ':' || "studentId"), 1, 24),
    "studentId",
    "instructorId",
    MIN("createdAt"),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "BehaviorRecord"
GROUP BY "studentId", "instructorId";
