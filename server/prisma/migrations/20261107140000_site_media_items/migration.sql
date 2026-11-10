-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SiteMediaSlot" AS ENUM ('HOME_HERO', 'HOME_GALLERY', 'STUDENT_ACTIVITY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SiteMediaItem" (
    "id" TEXT NOT NULL,
    "slot" "SiteMediaSlot" NOT NULL,
    "title" TEXT NOT NULL,
    "altText" TEXT NOT NULL DEFAULT '',
    "imagePath" TEXT NOT NULL,
    "href" TEXT,
    "ctaLabel" TEXT,
    "tag" TEXT,
    "summary" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteMediaItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SiteMediaItem_slot_isActive_sortOrder_idx" ON "SiteMediaItem"("slot", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "SiteMediaItem_createdByUserId_idx" ON "SiteMediaItem"("createdByUserId");
