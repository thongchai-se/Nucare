-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "maintenanceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT '',
    "facultyNameTh" TEXT NOT NULL,
    "universityNameTh" TEXT NOT NULL,
    "facultyEnglishBanner" TEXT NOT NULL,
    "contactAddress" TEXT NOT NULL,
    "contactPhoneDisplay" TEXT NOT NULL,
    "contactPhoneTel" TEXT NOT NULL,
    "contactFaxDisplay" TEXT NOT NULL DEFAULT '',
    "contactOfficeHoursLabel" TEXT NOT NULL DEFAULT '',
    "contactOfficeHours" TEXT NOT NULL DEFAULT '',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);
