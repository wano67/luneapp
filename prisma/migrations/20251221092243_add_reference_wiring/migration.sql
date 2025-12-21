-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "categoryReferenceId" BIGINT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "categoryReferenceId" BIGINT;

-- CreateTable
CREATE TABLE "ProjectTag" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTag" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTag_referenceId_idx" ON "ProjectTag"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTag_projectId_referenceId_key" ON "ProjectTag"("projectId", "referenceId");

-- CreateIndex
CREATE INDEX "ServiceTag_referenceId_idx" ON "ServiceTag"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceTag_serviceId_referenceId_key" ON "ServiceTag"("serviceId", "referenceId");

-- CreateIndex
CREATE INDEX "Project_businessId_categoryReferenceId_idx" ON "Project"("businessId", "categoryReferenceId");

-- CreateIndex
CREATE INDEX "Service_businessId_categoryReferenceId_idx" ON "Service"("businessId", "categoryReferenceId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_categoryReferenceId_fkey" FOREIGN KEY ("categoryReferenceId") REFERENCES "BusinessReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryReferenceId_fkey" FOREIGN KEY ("categoryReferenceId") REFERENCES "BusinessReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTag" ADD CONSTRAINT "ProjectTag_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "BusinessReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTag" ADD CONSTRAINT "ServiceTag_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTag" ADD CONSTRAINT "ServiceTag_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "BusinessReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
