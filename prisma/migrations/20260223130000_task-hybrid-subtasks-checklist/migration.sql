-- Add parentTaskId for hierarchical tasks
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "parentTaskId" BIGINT;

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_parentTaskId_fkey";
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_parentTaskId_fkey"
  FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- Checklist items attached to tasks
CREATE TABLE IF NOT EXISTS "TaskChecklistItem" (
    "id" BIGSERIAL NOT NULL,
    "taskId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TaskChecklistItem_taskId_position_idx" ON "TaskChecklistItem"("taskId", "position");

ALTER TABLE "TaskChecklistItem" DROP CONSTRAINT IF EXISTS "TaskChecklistItem_taskId_fkey";
ALTER TABLE "TaskChecklistItem"
  ADD CONSTRAINT "TaskChecklistItem_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaskChecklistItem" DROP CONSTRAINT IF EXISTS "TaskChecklistItem_completedByUserId_fkey";
ALTER TABLE "TaskChecklistItem"
  ADD CONSTRAINT "TaskChecklistItem_completedByUserId_fkey"
  FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill updatedAt trigger semantics for new table
ALTER TABLE "TaskChecklistItem" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
