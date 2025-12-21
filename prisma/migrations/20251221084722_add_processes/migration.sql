-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Process" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessStep" (
    "id" BIGSERIAL NOT NULL,
    "processId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Process_businessId_idx" ON "Process"("businessId");

-- CreateIndex
CREATE INDEX "ProcessStep_processId_idx" ON "ProcessStep"("processId");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessStep" ADD CONSTRAINT "ProcessStep_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
