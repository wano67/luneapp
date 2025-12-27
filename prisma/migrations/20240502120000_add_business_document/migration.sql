-- Add enum for document kind
DO $$ BEGIN
    CREATE TYPE "DocumentKind" AS ENUM ('FILE', 'INVOICE', 'QUOTE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create business documents table
CREATE TABLE IF NOT EXISTS "BusinessDocument" (
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

CREATE INDEX IF NOT EXISTS "BusinessDocument_business_client_createdAt_idx"
    ON "BusinessDocument" ("businessId", "clientId", "createdAt");

CREATE INDEX IF NOT EXISTS "BusinessDocument_business_createdAt_idx"
    ON "BusinessDocument" ("businessId", "createdAt");
