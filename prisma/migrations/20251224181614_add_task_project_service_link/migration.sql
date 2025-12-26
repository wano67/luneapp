-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "projectServiceId" BIGINT;

-- CreateIndex
CREATE INDEX "Task_projectServiceId_idx" ON "Task"("projectServiceId");

-- CreateIndex
CREATE INDEX "Task_projectId_projectServiceId_idx" ON "Task"("projectId", "projectServiceId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectServiceId_fkey" FOREIGN KEY ("projectServiceId") REFERENCES "ProjectService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
