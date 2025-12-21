-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextQuoteNumber" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "number" TEXT;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_number_key" ON "Invoice"("businessId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_businessId_number_key" ON "Quote"("businessId", "number");
