-- Add billing reference quote and cancellation metadata
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "billingQuoteId" BIGINT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Project_billingQuoteId_fkey'
  ) THEN
    ALTER TABLE "Project"
      ADD CONSTRAINT "Project_billingQuoteId_fkey"
      FOREIGN KEY ("billingQuoteId") REFERENCES "Quote"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Project_billingQuoteId_idx" ON "Project"("billingQuoteId");
