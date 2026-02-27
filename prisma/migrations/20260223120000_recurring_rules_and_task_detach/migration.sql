-- Ensure Task service links are nullable and detached on delete
ALTER TABLE "Task" ALTER COLUMN "projectServiceId" DROP NOT NULL;
ALTER TABLE "Task" ALTER COLUMN "projectServiceStepId" DROP NOT NULL;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_projectServiceId_fkey";
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_projectServiceId_fkey"
  FOREIGN KEY ("projectServiceId") REFERENCES "ProjectService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_projectServiceStepId_fkey";
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_projectServiceStepId_fkey"
  FOREIGN KEY ("projectServiceStepId") REFERENCES "ProjectServiceStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Finance recurring rules
CREATE TABLE IF NOT EXISTS "FinanceRecurringRule" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "projectId" BIGINT,
    "categoryReferenceId" BIGINT,
    "type" "FinanceType" NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "category" TEXT NOT NULL,
    "vendor" TEXT,
    "method" "PaymentMethod",
    "note" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "dayOfMonth" INTEGER NOT NULL,
    "frequency" "RecurringUnit" NOT NULL DEFAULT 'MONTHLY',
    "nextRunAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinanceRecurringRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "recurringRuleId" BIGINT;
ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "isRuleOverride" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Finance" ADD COLUMN IF NOT EXISTS "lockedFromRule" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Finance" DROP CONSTRAINT IF EXISTS "Finance_recurringRuleId_fkey";
ALTER TABLE "Finance"
  ADD CONSTRAINT "Finance_recurringRuleId_fkey"
  FOREIGN KEY ("recurringRuleId") REFERENCES "FinanceRecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT IF EXISTS "FinanceRecurringRule_businessId_fkey";
ALTER TABLE "FinanceRecurringRule"
  ADD CONSTRAINT "FinanceRecurringRule_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT IF EXISTS "FinanceRecurringRule_projectId_fkey";
ALTER TABLE "FinanceRecurringRule"
  ADD CONSTRAINT "FinanceRecurringRule_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FinanceRecurringRule" DROP CONSTRAINT IF EXISTS "FinanceRecurringRule_categoryReferenceId_fkey";
ALTER TABLE "FinanceRecurringRule"
  ADD CONSTRAINT "FinanceRecurringRule_categoryReferenceId_fkey"
  FOREIGN KEY ("categoryReferenceId") REFERENCES "BusinessReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "FinanceRecurringRule_businessId_isActive_idx" ON "FinanceRecurringRule"("businessId", "isActive");
CREATE INDEX IF NOT EXISTS "FinanceRecurringRule_businessId_nextRunAt_idx" ON "FinanceRecurringRule"("businessId", "nextRunAt");
CREATE INDEX IF NOT EXISTS "FinanceRecurringRule_businessId_projectId_idx" ON "FinanceRecurringRule"("businessId", "projectId");

CREATE INDEX IF NOT EXISTS "Finance_recurringRuleId_idx" ON "Finance"("recurringRuleId");
CREATE UNIQUE INDEX IF NOT EXISTS "Finance_recurringRuleId_date_key" ON "Finance"("recurringRuleId", "date");

-- Project service recurring rules
CREATE TABLE IF NOT EXISTS "ProjectServiceRecurringRule" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "projectId" BIGINT NOT NULL,
    "projectServiceId" BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "frequency" "RecurringUnit" NOT NULL DEFAULT 'MONTHLY',
    "nextRunAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "lastInvoicedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectServiceRecurringRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProjectServiceRecurringRule" DROP CONSTRAINT IF EXISTS "ProjectServiceRecurringRule_businessId_fkey";
ALTER TABLE "ProjectServiceRecurringRule"
  ADD CONSTRAINT "ProjectServiceRecurringRule_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectServiceRecurringRule" DROP CONSTRAINT IF EXISTS "ProjectServiceRecurringRule_projectId_fkey";
ALTER TABLE "ProjectServiceRecurringRule"
  ADD CONSTRAINT "ProjectServiceRecurringRule_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectServiceRecurringRule" DROP CONSTRAINT IF EXISTS "ProjectServiceRecurringRule_projectServiceId_fkey";
ALTER TABLE "ProjectServiceRecurringRule"
  ADD CONSTRAINT "ProjectServiceRecurringRule_projectServiceId_fkey"
  FOREIGN KEY ("projectServiceId") REFERENCES "ProjectService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectServiceRecurringRule_projectServiceId_key" ON "ProjectServiceRecurringRule"("projectServiceId");
CREATE INDEX IF NOT EXISTS "ProjectServiceRecurringRule_businessId_projectId_idx" ON "ProjectServiceRecurringRule"("businessId", "projectId");
CREATE INDEX IF NOT EXISTS "ProjectServiceRecurringRule_businessId_nextRunAt_idx" ON "ProjectServiceRecurringRule"("businessId", "nextRunAt");
