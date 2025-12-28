DO $$
BEGIN
    -- Skip if Business table is not present (DB vide)
    IF to_regclass('public."Business"') IS NULL THEN
        RAISE NOTICE 'Skipping 20240502120000_add_business_document: Business table missing';
        RETURN;
    END IF;

    -- Add enum for document kind if absent
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentKind') THEN
        CREATE TYPE "DocumentKind" AS ENUM ('FILE', 'INVOICE', 'QUOTE');
    END IF;

    -- If table already exists, skip
    IF to_regclass('public."BusinessDocument"') IS NOT NULL THEN
        RAISE NOTICE 'BusinessDocument already exists, skipping';
        RETURN;
    END IF;

    -- Create business documents table
    CREATE TABLE "BusinessDocument" (
        "id" BIGSERIAL PRIMARY KEY,
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
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "BusinessDocument_storageKey_key" UNIQUE ("storageKey"),
        CONSTRAINT "BusinessDocument_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE,
        CONSTRAINT "BusinessDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL,
        CONSTRAINT "BusinessDocument_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE RESTRICT
    );

    CREATE INDEX "BusinessDocument_business_client_createdAt_idx"
        ON "BusinessDocument" ("businessId", "clientId", "createdAt");

    CREATE INDEX "BusinessDocument_business_createdAt_idx"
        ON "BusinessDocument" ("businessId", "createdAt");
END $$;
