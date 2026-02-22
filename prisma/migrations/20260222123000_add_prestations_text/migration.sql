-- Add project prestations narrative + snapshots on documents
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "prestationsText" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "prestationsSnapshotText" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "prestationsSnapshotText" TEXT;
