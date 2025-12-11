-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('UNKNOWN', 'OUTBOUND', 'INBOUND', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "QualificationLevel" AS ENUM ('COLD', 'WARM', 'HOT');

-- CreateEnum
CREATE TYPE "ProspectPipelineStatus" AS ENUM ('NEW', 'IN_DISCUSSION', 'OFFER_SENT', 'FOLLOW_UP', 'CLOSED');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'FORMER');

-- CreateTable
CREATE TABLE "Prospect" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "source" "LeadSource",
    "interestNote" TEXT,
    "qualificationLevel" "QualificationLevel",
    "projectIdea" TEXT,
    "estimatedBudget" INTEGER,
    "firstContactAt" TIMESTAMP(3),
    "pipelineStatus" "ProspectPipelineStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Client"
    ADD COLUMN "address" TEXT,
    ADD COLUMN "companyName" TEXT,
    ADD COLUMN "entryDate" TIMESTAMP(3),
    ADD COLUMN "estimatedBudget" INTEGER,
    ADD COLUMN "leadSource" "LeadSource",
    ADD COLUMN "mainContactName" TEXT,
    ADD COLUMN "needsType" TEXT,
    ADD COLUMN "sector" TEXT,
    ADD COLUMN "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE';

-- Adjust foreign key to cascade on delete
ALTER TABLE "Client" DROP CONSTRAINT "Client_businessId_fkey";
ALTER TABLE "Client" ADD CONSTRAINT "Client_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index to speed up prospect queries per business
CREATE INDEX "Prospect_businessId_idx" ON "Prospect"("businessId");
