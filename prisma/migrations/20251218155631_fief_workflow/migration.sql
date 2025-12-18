-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NEW', 'FOLLOW_UP', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "ProjectQuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'SIGNED');

-- CreateEnum
CREATE TYPE "ProjectDepositStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "TaskPhase" AS ENUM ('CADRAGE', 'UX', 'DESIGN', 'DEV', 'SEO', 'LAUNCH', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'NOTE', 'MESSAGE');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "depositStatus" "ProjectDepositStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "quoteStatus" "ProjectQuoteStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Prospect" ADD COLUMN     "nextActionDate" TIMESTAMP(3),
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "probability" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ProspectStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phase" "TaskPhase",
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Service" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "defaultPriceCents" BIGINT,
    "tjmCents" BIGINT,
    "durationHours" INTEGER,
    "vatRate" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceTaskTemplate" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "phase" "TaskPhase",
    "title" TEXT NOT NULL,
    "defaultAssigneeRole" TEXT,
    "defaultDueOffsetDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectService" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" BIGINT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "clientId" BIGINT,
    "projectId" BIGINT,
    "type" "InteractionType" NOT NULL,
    "content" TEXT NOT NULL,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "nextActionDate" TIMESTAMP(3),
    "createdByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE INDEX "Service_businessId_code_idx" ON "Service"("businessId", "code");

-- CreateIndex
CREATE INDEX "ProjectService_projectId_serviceId_idx" ON "ProjectService"("projectId", "serviceId");

-- CreateIndex
CREATE INDEX "Interaction_businessId_clientId_idx" ON "Interaction"("businessId", "clientId");

-- CreateIndex
CREATE INDEX "Interaction_businessId_projectId_idx" ON "Interaction"("businessId", "projectId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceTaskTemplate" ADD CONSTRAINT "ServiceTaskTemplate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectService" ADD CONSTRAINT "ProjectService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
