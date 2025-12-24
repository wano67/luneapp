-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "anonymizationReason" TEXT,
ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "anonymizedByUserId" BIGINT;

-- CreateIndex
CREATE INDEX "Client_businessId_anonymizedAt_idx" ON "Client"("businessId", "anonymizedAt");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_anonymizedByUserId_fkey" FOREIGN KEY ("anonymizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
