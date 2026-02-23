-- Project members, organization units, task status audit fields

-- OrganizationUnit
CREATE TABLE IF NOT EXISTS "OrganizationUnit" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationUnit_businessId_name_key" ON "OrganizationUnit"("businessId", "name");
CREATE INDEX IF NOT EXISTS "OrganizationUnit_businessId_order_idx" ON "OrganizationUnit"("businessId", "order");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OrganizationUnit_businessId_fkey'
  ) THEN
    ALTER TABLE "OrganizationUnit"
      ADD CONSTRAINT "OrganizationUnit_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- BusinessMembership.organizationUnitId
ALTER TABLE "BusinessMembership" ADD COLUMN IF NOT EXISTS "organizationUnitId" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessMembership_organizationUnitId_fkey'
  ) THEN
    ALTER TABLE "BusinessMembership"
      ADD CONSTRAINT "BusinessMembership_organizationUnitId_fkey"
      FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "BusinessMembership_organizationUnitId_idx" ON "BusinessMembership"("organizationUnitId");

-- ProjectMember
CREATE TABLE IF NOT EXISTS "ProjectMember" (
    "id" BIGSERIAL NOT NULL,
    "projectId" BIGINT NOT NULL,
    "membershipId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectMember_projectId_membershipId_key" ON "ProjectMember"("projectId", "membershipId");
CREATE INDEX IF NOT EXISTS "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");
CREATE INDEX IF NOT EXISTS "ProjectMember_membershipId_idx" ON "ProjectMember"("membershipId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectMember"
      ADD CONSTRAINT "ProjectMember_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectMember_membershipId_fkey'
  ) THEN
    ALTER TABLE "ProjectMember"
      ADD CONSTRAINT "ProjectMember_membershipId_fkey"
      FOREIGN KEY ("membershipId") REFERENCES "BusinessMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Task status audit fields
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "statusUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "statusUpdatedByUserId" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Task_statusUpdatedByUserId_fkey'
  ) THEN
    ALTER TABLE "Task"
      ADD CONSTRAINT "Task_statusUpdatedByUserId_fkey"
      FOREIGN KEY ("statusUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Task_projectId_statusUpdatedAt_idx" ON "Task"("projectId", "statusUpdatedAt");
CREATE INDEX IF NOT EXISTS "Task_statusUpdatedByUserId_idx" ON "Task"("statusUpdatedByUserId");
