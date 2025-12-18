-- CreateEnum
CREATE TYPE "FinanceType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "Finance" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "projectId" BIGINT,
    "type" "FinanceType" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Finance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Finance_businessId_date_idx" ON "Finance"("businessId", "date");

-- CreateIndex
CREATE INDEX "Finance_businessId_type_idx" ON "Finance"("businessId", "type");

-- AddForeignKey
ALTER TABLE "Finance" ADD CONSTRAINT "Finance_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finance" ADD CONSTRAINT "Finance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
