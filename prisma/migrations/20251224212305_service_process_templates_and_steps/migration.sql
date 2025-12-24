-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "projectServiceStepId" BIGINT;

-- CreateTable
CREATE TABLE "ServiceProcessTemplate" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceProcessTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProcessPhaseTemplate" (
    "id" BIGSERIAL NOT NULL,
    "templateId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ServiceProcessPhaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProcessStepTemplate" (
    "id" BIGSERIAL NOT NULL,
    "phaseId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isBillableMilestone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ServiceProcessStepTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceProcessTaskTemplate" (
    "id" BIGSERIAL NOT NULL,
    "stepId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "dueOffsetDays" INTEGER,
    "defaultAssigneeRole" TEXT,

    CONSTRAINT "ServiceProcessTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectServiceStep" (
    "id" BIGSERIAL NOT NULL,
    "projectServiceId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "phaseName" TEXT,
    "isBillableMilestone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectServiceStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProcessTemplate_serviceId_key" ON "ServiceProcessTemplate"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceProcessTemplate_businessId_idx" ON "ServiceProcessTemplate"("businessId");

-- CreateIndex
CREATE INDEX "ServiceProcessPhaseTemplate_templateId_idx" ON "ServiceProcessPhaseTemplate"("templateId");

-- CreateIndex
CREATE INDEX "ServiceProcessPhaseTemplate_templateId_order_idx" ON "ServiceProcessPhaseTemplate"("templateId", "order");

-- CreateIndex
CREATE INDEX "ServiceProcessStepTemplate_phaseId_idx" ON "ServiceProcessStepTemplate"("phaseId");

-- CreateIndex
CREATE INDEX "ServiceProcessStepTemplate_phaseId_order_idx" ON "ServiceProcessStepTemplate"("phaseId", "order");

-- CreateIndex
CREATE INDEX "ServiceProcessTaskTemplate_stepId_idx" ON "ServiceProcessTaskTemplate"("stepId");

-- CreateIndex
CREATE INDEX "ServiceProcessTaskTemplate_stepId_order_idx" ON "ServiceProcessTaskTemplate"("stepId", "order");

-- CreateIndex
CREATE INDEX "ProjectServiceStep_projectServiceId_idx" ON "ProjectServiceStep"("projectServiceId");

-- CreateIndex
CREATE INDEX "ProjectServiceStep_projectServiceId_order_idx" ON "ProjectServiceStep"("projectServiceId", "order");

-- CreateIndex
CREATE INDEX "Task_projectServiceStepId_idx" ON "Task"("projectServiceStepId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectServiceStepId_fkey" FOREIGN KEY ("projectServiceStepId") REFERENCES "ProjectServiceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProcessTemplate" ADD CONSTRAINT "ServiceProcessTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProcessTemplate" ADD CONSTRAINT "ServiceProcessTemplate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProcessPhaseTemplate" ADD CONSTRAINT "ServiceProcessPhaseTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ServiceProcessTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProcessStepTemplate" ADD CONSTRAINT "ServiceProcessStepTemplate_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ServiceProcessPhaseTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceProcessTaskTemplate" ADD CONSTRAINT "ServiceProcessTaskTemplate_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "ServiceProcessStepTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectServiceStep" ADD CONSTRAINT "ProjectServiceStep_projectServiceId_fkey" FOREIGN KEY ("projectServiceId") REFERENCES "ProjectService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
