-- This is an empty migration.
-- Add legal/contact fields to Business
ALTER TABLE "Business"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT 'FR',
  ADD COLUMN "siret" TEXT,
  ADD COLUMN "vatNumber" TEXT,
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "city" TEXT;

-- Add currency to BusinessSettings
ALTER TABLE "BusinessSettings"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';
