-- Add billing fields to Business
ALTER TABLE "Business"
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "billingPhone" TEXT,
  ADD COLUMN "iban" TEXT,
  ADD COLUMN "bic" TEXT,
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "accountHolder" TEXT,
  ADD COLUMN "billingLegalText" TEXT;

-- Add billing fields to Client
ALTER TABLE "Client"
  ADD COLUMN "billingCompanyName" TEXT,
  ADD COLUMN "billingContactName" TEXT,
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "billingPhone" TEXT,
  ADD COLUMN "billingVatNumber" TEXT,
  ADD COLUMN "billingAddressLine1" TEXT,
  ADD COLUMN "billingAddressLine2" TEXT,
  ADD COLUMN "billingPostalCode" TEXT,
  ADD COLUMN "billingCity" TEXT,
  ADD COLUMN "billingCountryCode" TEXT;

-- Add ordering to ProjectService
ALTER TABLE "ProjectService"
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "createdAt" ASC, id ASC) - 1 AS pos
  FROM "ProjectService"
)
UPDATE "ProjectService" ps
SET "position" = ordered.pos
FROM ordered
WHERE ps.id = ordered.id;

-- Add snapshots to Quote/Invoice
ALTER TABLE "Quote"
  ADD COLUMN "issuerSnapshotJson" JSONB,
  ADD COLUMN "clientSnapshotJson" JSONB;

ALTER TABLE "Invoice"
  ADD COLUMN "issuerSnapshotJson" JSONB,
  ADD COLUMN "clientSnapshotJson" JSONB;

-- Add line description fields
ALTER TABLE "QuoteItem"
  ADD COLUMN "description" TEXT;

ALTER TABLE "InvoiceItem"
  ADD COLUMN "description" TEXT;

-- Update invoice prefix default to FAC-
ALTER TABLE "BusinessSettings"
  ALTER COLUMN "invoicePrefix" SET DEFAULT 'FAC-';

UPDATE "BusinessSettings"
SET "invoicePrefix" = 'FAC-'
WHERE "invoicePrefix" = 'INV-';

-- Number sequence (per business/year/kind)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NumberSequenceKind') THEN
    CREATE TYPE "NumberSequenceKind" AS ENUM ('QUOTE', 'INVOICE');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "NumberSequence" (
  "id" BIGSERIAL PRIMARY KEY,
  "businessId" BIGINT NOT NULL,
  "kind" "NumberSequenceKind" NOT NULL,
  "year" INTEGER NOT NULL,
  "lastNumber" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "NumberSequence_businessId_kind_year_key"
  ON "NumberSequence"("businessId", "kind", "year");

CREATE INDEX IF NOT EXISTS "NumberSequence_businessId_kind_year_idx"
  ON "NumberSequence"("businessId", "kind", "year");

ALTER TABLE "NumberSequence"
  ADD CONSTRAINT "NumberSequence_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed sequences from existing settings for current year (best effort)
INSERT INTO "NumberSequence" ("businessId", "kind", "year", "lastNumber", "createdAt", "updatedAt")
SELECT
  bs."businessId",
  'QUOTE',
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  GREATEST(bs."nextQuoteNumber" - 1, 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BusinessSettings" bs
ON CONFLICT ("businessId", "kind", "year") DO NOTHING;

INSERT INTO "NumberSequence" ("businessId", "kind", "year", "lastNumber", "createdAt", "updatedAt")
SELECT
  bs."businessId",
  'INVOICE',
  EXTRACT(YEAR FROM CURRENT_DATE)::int,
  GREATEST(bs."nextInvoiceNumber" - 1, 0),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "BusinessSettings" bs
ON CONFLICT ("businessId", "kind", "year") DO NOTHING;
