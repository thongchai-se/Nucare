-- ผู้เชี่ยวชาญปฏิเสธคิวทีละคน — ปิดคิวเมื่อผู้เชี่ยวชาญที่ยังใช้งานปฏิเสธครบ
CREATE TABLE "CaseReferralDecline" (
    "id" TEXT NOT NULL,
    "referralId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseReferralDecline_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseReferralDecline_referralId_userId_key" ON "CaseReferralDecline"("referralId", "userId");

CREATE INDEX "CaseReferralDecline_userId_createdAt_idx" ON "CaseReferralDecline"("userId", "createdAt");

CREATE INDEX "CaseReferralDecline_referralId_createdAt_idx" ON "CaseReferralDecline"("referralId", "createdAt");

ALTER TABLE "CaseReferralDecline" ADD CONSTRAINT "CaseReferralDecline_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "CaseReferral"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseReferralDecline" ADD CONSTRAINT "CaseReferralDecline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
