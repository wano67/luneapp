-- Payments + finance soft-delete metadata
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentMethod') THEN
    CREATE TYPE "PaymentMethod" AS ENUM ('WIRE', 'CARD', 'CASH', 'CHECK', 'OTHER');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RecurringUnit') THEN
    CREATE TYPE "RecurringUnit" AS ENUM ('MONTHLY', 'YEARLY');
  END IF;
END $$;

ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "vendor" TEXT;
ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "method" "PaymentMethod";
ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "isRecurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "recurringUnit" "RecurringUnit";
ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Finance_businessId_deletedAt_idx" ON "Finance"("businessId", "deletedAt");

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" BIGSERIAL PRIMARY KEY,
  "businessId" BIGINT NOT NULL,
  "invoiceId" BIGINT NOT NULL,
  "projectId" BIGINT,
  "clientId" BIGINT,
  "amountCents" BIGINT NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" "PaymentMethod" NOT NULL DEFAULT 'WIRE',
  "reference" TEXT,
  "note" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE,
  ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL,
  ADD CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Payment_businessId_paidAt_idx" ON "Payment"("businessId", "paidAt");
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");
CREATE INDEX IF NOT EXISTS "Payment_projectId_idx" ON "Payment"("projectId");
CREATE INDEX IF NOT EXISTS "Payment_clientId_idx" ON "Payment"("clientId");
CREATE INDEX IF NOT EXISTS "Payment_businessId_deletedAt_idx" ON "Payment"("businessId", "deletedAt");
