-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "categoryReferenceId" BIGINT;

-- CreateTable
CREATE TABLE "TaskTag" (
    "id" BIGSERIAL NOT NULL,
    "taskId" BIGINT NOT NULL,
    "referenceId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskTag_referenceId_idx" ON "TaskTag"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_taskId_referenceId_key" ON "TaskTag"("taskId", "referenceId");

-- CreateIndex
CREATE INDEX "Task_businessId_categoryReferenceId_idx" ON "Task"("businessId", "categoryReferenceId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryReferenceId_fkey" FOREIGN KEY ("categoryReferenceId") REFERENCES "BusinessReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "BusinessReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
