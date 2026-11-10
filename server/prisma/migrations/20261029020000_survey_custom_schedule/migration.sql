-- CreateEnum
CREATE TYPE "SurveyScheduleUnit" AS ENUM ('DAYS', 'WEEKS', 'MONTHS');

-- AlterEnum
ALTER TYPE "SurveyFrequency" ADD VALUE 'CUSTOM_INTERVAL';

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN "scheduleEvery" INTEGER,
ADD COLUMN "scheduleUnit" "SurveyScheduleUnit";
