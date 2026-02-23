-- Add createdByUserId to Payment for auditability
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "createdByUserId" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Payment_createdByUserId_fkey'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Payment_createdByUserId_idx" ON "Payment"("createdByUserId");
