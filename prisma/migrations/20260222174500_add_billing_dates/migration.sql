-- Add accounting dates for deposits and signed quotes
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
