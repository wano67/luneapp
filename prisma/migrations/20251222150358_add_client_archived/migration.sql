-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Client_businessId_archivedAt_idx" ON "Client"("businessId", "archivedAt");
