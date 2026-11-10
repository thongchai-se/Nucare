-- CreateTable
CREATE TABLE "DirectoryStudent" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "studyYear" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectoryStaff" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectoryStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryStudent_studentId_key" ON "DirectoryStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryStudent_email_key" ON "DirectoryStudent"("email");

-- CreateIndex
CREATE INDEX "DirectoryStudent_isActive_studyYear_idx" ON "DirectoryStudent"("isActive", "studyYear");

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryStaff_employeeId_key" ON "DirectoryStaff"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectoryStaff_email_key" ON "DirectoryStaff"("email");

-- CreateIndex
CREATE INDEX "DirectoryStaff_isActive_idx" ON "DirectoryStaff"("isActive");
