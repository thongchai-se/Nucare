-- บันทึกเวลา/เหตุผลการรับ-ปิดแจ้งเตือน เพื่อเส้นทางติดตามข้อสังเกต
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3);
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "Alert" ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;
