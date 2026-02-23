DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentKind') THEN
    CREATE TYPE "DocumentKind" AS ENUM ('FILE', 'INVOICE', 'QUOTE');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public."Business"') IS NULL THEN
    RAISE NOTICE 'Skipping 20250310120000_fix_schema_drift: Business table missing';
    RETURN;
  END IF;

  -- Ensure BusinessDocument table exists with expected shape
  CREATE TABLE IF NOT EXISTS "BusinessDocument" (
      "id" BIGSERIAL NOT NULL,
      "businessId" BIGINT NOT NULL,
      "clientId" BIGINT,
      "title" TEXT NOT NULL,
      "filename" TEXT NOT NULL,
      "mimeType" TEXT NOT NULL,
      "sizeBytes" INTEGER NOT NULL,
      "storageKey" TEXT NOT NULL,
      "sha256" TEXT,
      "kind" "DocumentKind" NOT NULL DEFAULT 'FILE',
      "createdByUserId" BIGINT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BusinessDocument_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "BusinessDocument_storageKey_key" UNIQUE ("storageKey")
  );

  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "businessId" BIGINT NOT NULL;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "clientId" BIGINT;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "filename" TEXT NOT NULL;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "mimeType" TEXT NOT NULL;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER NOT NULL;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "storageKey" TEXT NOT NULL;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "sha256" TEXT;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "kind" "DocumentKind" NOT NULL DEFAULT 'FILE';
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "createdByUserId" BIGINT NOT NULL;
  ALTER TABLE "BusinessDocument" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

  ALTER TABLE "BusinessDocument" ALTER COLUMN "createdAt" TYPE TIMESTAMP(3) USING "createdAt";
  ALTER TABLE "BusinessDocument" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;

  ALTER TABLE "BusinessDocument" DROP CONSTRAINT IF EXISTS "BusinessDocument_storageKey_key";
  ALTER TABLE "BusinessDocument" ADD CONSTRAINT "BusinessDocument_storageKey_key" UNIQUE ("storageKey");

  ALTER TABLE "BusinessDocument" DROP CONSTRAINT IF EXISTS "BusinessDocument_businessId_fkey";
  ALTER TABLE "BusinessDocument" DROP CONSTRAINT IF EXISTS "BusinessDocument_clientId_fkey";
  ALTER TABLE "BusinessDocument" DROP CONSTRAINT IF EXISTS "BusinessDocument_createdByUserId_fkey";

  ALTER TABLE "BusinessDocument"
    ADD CONSTRAINT "BusinessDocument_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "BusinessDocument"
    ADD CONSTRAINT "BusinessDocument_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "BusinessDocument"
    ADD CONSTRAINT "BusinessDocument_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'BusinessDocument_business_client_createdAt_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'BusinessDocument_businessId_clientId_createdAt_idx') THEN
    ALTER INDEX "BusinessDocument_business_client_createdAt_idx" RENAME TO "BusinessDocument_businessId_clientId_createdAt_idx";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'BusinessDocument_business_createdAt_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'BusinessDocument_businessId_createdAt_idx') THEN
    ALTER INDEX "BusinessDocument_business_createdAt_idx" RENAME TO "BusinessDocument_businessId_createdAt_idx";
  END IF;

  CREATE INDEX IF NOT EXISTS "BusinessDocument_businessId_clientId_createdAt_idx" ON "BusinessDocument"("businessId", "clientId", "createdAt");
  CREATE INDEX IF NOT EXISTS "BusinessDocument_businessId_createdAt_idx" ON "BusinessDocument"("businessId", "createdAt");

  -- ServiceTaskTemplate missing columns
  IF to_regclass('public."ServiceTaskTemplate"') IS NOT NULL THEN
    ALTER TABLE "ServiceTaskTemplate" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER;
    ALTER TABLE "ServiceTaskTemplate" ADD COLUMN IF NOT EXISTS "position" INTEGER;
    ALTER TABLE "ServiceTaskTemplate" ALTER COLUMN "position" SET DEFAULT 0;
    UPDATE "ServiceTaskTemplate" SET "position" = 0 WHERE "position" IS NULL;
    ALTER TABLE "ServiceTaskTemplate" ALTER COLUMN "position" SET NOT NULL;
  END IF;

  -- Create ProductImage table if it drifted out
  IF to_regclass('public."Product"') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS "ProductImage" (
        "id" BIGSERIAL NOT NULL,
        "businessId" BIGINT NOT NULL,
        "productId" BIGINT NOT NULL,
        "storageKey" TEXT NOT NULL,
        "mimeType" TEXT NOT NULL,
        "alt" TEXT,
        "position" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX IF NOT EXISTS "ProductImage_productId_idx" ON "ProductImage"("productId");
    CREATE INDEX IF NOT EXISTS "ProductImage_businessId_productId_position_idx" ON "ProductImage"("businessId", "productId", "position");

    ALTER TABLE "ProductImage" DROP CONSTRAINT IF EXISTS "ProductImage_businessId_fkey";
    ALTER TABLE "ProductImage" DROP CONSTRAINT IF EXISTS "ProductImage_productId_fkey";

    ALTER TABLE "ProductImage"
      ADD CONSTRAINT "ProductImage_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "ProductImage"
      ADD CONSTRAINT "ProductImage_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- Create ServiceTemplateTask table if missing
  IF to_regclass('public."ServiceTaskTemplate"') IS NOT NULL THEN
    CREATE TABLE IF NOT EXISTS "ServiceTemplateTask" (
        "id" BIGSERIAL NOT NULL,
        "templateId" BIGINT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "role" TEXT,
        "estimatedMinutes" INTEGER,
        "position" INTEGER NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ServiceTemplateTask_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX IF NOT EXISTS "ServiceTemplateTask_templateId_idx" ON "ServiceTemplateTask"("templateId");
    CREATE INDEX IF NOT EXISTS "ServiceTemplateTask_templateId_position_idx" ON "ServiceTemplateTask"("templateId", "position");

    ALTER TABLE "ServiceTemplateTask" DROP CONSTRAINT IF EXISTS "ServiceTemplateTask_templateId_fkey";

    ALTER TABLE "ServiceTemplateTask"
      ADD CONSTRAINT "ServiceTemplateTask_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "ServiceTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
