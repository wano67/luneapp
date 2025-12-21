-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "categoryReferenceId" BIGINT;

-- CreateTable
CREATE TABLE "ClientTag" (
    "id" BIGSERIAL NOT NULL,
    "clientId" BIGINT NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientTag_referenceId_idx" ON "ClientTag"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientTag_clientId_referenceId_key" ON "ClientTag"("clientId", "referenceId");

-- CreateIndex
CREATE INDEX "Client_businessId_categoryReferenceId_idx" ON "Client"("businessId", "categoryReferenceId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_categoryReferenceId_fkey" FOREIGN KEY ("categoryReferenceId") REFERENCES "BusinessReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTag" ADD CONSTRAINT "ClientTag_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "BusinessReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
