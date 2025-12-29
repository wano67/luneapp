-- Business legal/onboarding fields
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "legalName" TEXT,
  ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'FR',
  ADD COLUMN IF NOT EXISTS "siret" TEXT,
  ADD COLUMN IF NOT EXISTS "vatNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT;

-- Settings currency + TVA defaults
ALTER TABLE "BusinessSettings"
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'EUR';
