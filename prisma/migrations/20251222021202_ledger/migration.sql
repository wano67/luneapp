-- CreateEnum
CREATE TYPE "LedgerSourceType" AS ENUM ('INVENTORY_MOVEMENT', 'INVOICE_STOCK_CONSUMPTION');

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "accountCashCode" TEXT NOT NULL DEFAULT '5300',
ADD COLUMN     "accountCogsCode" TEXT NOT NULL DEFAULT '6000',
ADD COLUMN     "accountInventoryCode" TEXT NOT NULL DEFAULT '3700',
ADD COLUMN     "accountRevenueCode" TEXT NOT NULL DEFAULT '7000';

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "sourceType" "LedgerSourceType" NOT NULL,
    "sourceId" BIGINT,
    "createdByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerLine" (
    "id" BIGSERIAL NOT NULL,
    "entryId" BIGINT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT,
    "debitCents" BIGINT,
    "creditCents" BIGINT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerEntry_businessId_date_idx" ON "LedgerEntry"("businessId", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_sourceType_sourceId_idx" ON "LedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "LedgerLine_entryId_idx" ON "LedgerLine"("entryId");

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerLine" ADD CONSTRAINT "LedgerLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

