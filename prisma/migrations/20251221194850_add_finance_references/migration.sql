-- AlterTable
ALTER TABLE "Finance" ADD COLUMN     "categoryReferenceId" BIGINT;

-- CreateTable
CREATE TABLE "FinanceTag" (
    "id" BIGSERIAL NOT NULL,
    "financeId" BIGINT NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceTag_referenceId_idx" ON "FinanceTag"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTag_financeId_referenceId_key" ON "FinanceTag"("financeId", "referenceId");

-- CreateIndex
CREATE INDEX "Finance_businessId_categoryReferenceId_idx" ON "Finance"("businessId", "categoryReferenceId");

-- AddForeignKey
ALTER TABLE "Finance" ADD CONSTRAINT "Finance_categoryReferenceId_fkey" FOREIGN KEY ("categoryReferenceId") REFERENCES "BusinessReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTag" ADD CONSTRAINT "FinanceTag_financeId_fkey" FOREIGN KEY ("financeId") REFERENCES "Finance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTag" ADD CONSTRAINT "FinanceTag_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "BusinessReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
