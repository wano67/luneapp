-- Billing enhancements: legal texts, discounting, billing units, references, prefixes

-- New enums
DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('NONE', 'PERCENT', 'AMOUNT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "BillingUnit" AS ENUM ('ONE_OFF', 'MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- BusinessSettings: new legal text fields and default prefixes
ALTER TABLE "BusinessSettings"
  ADD COLUMN IF NOT EXISTS "cgvText" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentTermsText" TEXT,
  ADD COLUMN IF NOT EXISTS "lateFeesText" TEXT,
  ADD COLUMN IF NOT EXISTS "legalMentionsText" TEXT;

ALTER TABLE "BusinessSettings"
  ALTER COLUMN "invoicePrefix" SET DEFAULT 'SF-FAC',
  ALTER COLUMN "quotePrefix" SET DEFAULT 'SF-DEV';

UPDATE "BusinessSettings"
  SET "invoicePrefix" = 'SF-FAC',
      "quotePrefix" = 'SF-DEV';

-- Client: billing reference (PO / ref)
ALTER TABLE "Client"
  ADD COLUMN IF NOT EXISTS "billingReference" TEXT;

-- ProjectService: billing fields
ALTER TABLE "ProjectService"
  ADD COLUMN IF NOT EXISTS "titleOverride" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "discountValue" INTEGER,
  ADD COLUMN IF NOT EXISTS "billingUnit" "BillingUnit" NOT NULL DEFAULT 'ONE_OFF',
  ADD COLUMN IF NOT EXISTS "unitLabel" TEXT;

UPDATE "ProjectService"
  SET "description" = "notes"
  WHERE "description" IS NULL AND "notes" IS NOT NULL;

-- QuoteItem: discount + unit metadata
ALTER TABLE "QuoteItem"
  ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "discountValue" INTEGER,
  ADD COLUMN IF NOT EXISTS "originalUnitPriceCents" BIGINT,
  ADD COLUMN IF NOT EXISTS "unitLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "billingUnit" "BillingUnit" NOT NULL DEFAULT 'ONE_OFF';

-- InvoiceItem: discount + unit metadata
ALTER TABLE "InvoiceItem"
  ADD COLUMN IF NOT EXISTS "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "discountValue" INTEGER,
  ADD COLUMN IF NOT EXISTS "originalUnitPriceCents" BIGINT,
  ADD COLUMN IF NOT EXISTS "unitLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "billingUnit" "BillingUnit" NOT NULL DEFAULT 'ONE_OFF';
