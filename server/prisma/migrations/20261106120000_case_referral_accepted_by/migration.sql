-- Persist who accepted a counseling referral for ownership checks.
ALTER TABLE "CaseReferral" ADD COLUMN IF NOT EXISTS "acceptedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "CaseReferral_acceptedByUserId_status_idx"
  ON "CaseReferral"("acceptedByUserId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CaseReferral_acceptedByUserId_fkey'
  ) THEN
    ALTER TABLE "CaseReferral"
      ADD CONSTRAINT "CaseReferral_acceptedByUserId_fkey"
      FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
