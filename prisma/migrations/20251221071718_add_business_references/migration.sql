-- CreateEnum
CREATE TYPE "BusinessReferenceType" AS ENUM ('CATEGORY', 'TAG', 'NUMBERING', 'AUTOMATION');

-- DropIndex
DROP INDEX "Invoice_businessId_idx";

-- DropIndex
DROP INDEX "Invoice_projectId_idx";

-- DropIndex
DROP INDEX "InvoiceItem_invoiceId_idx";

-- DropIndex
DROP INDEX "Quote_businessId_idx";

-- DropIndex
DROP INDEX "Quote_projectId_idx";

-- DropIndex
DROP INDEX "QuoteItem_quoteId_idx";

-- AlterTable
ALTER TABLE "Invoice" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InvoiceItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QuoteItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BusinessReference" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "type" "BusinessReferenceType" NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessReference_businessId_type_idx" ON "BusinessReference"("businessId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessReference_businessId_type_name_key" ON "BusinessReference"("businessId", "type", "name");

-- AddForeignKey
ALTER TABLE "BusinessReference" ADD CONSTRAINT "BusinessReference_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
