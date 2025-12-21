-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "BusinessPermission" AS ENUM ('TEAM_EDIT', 'FINANCE_EDIT');

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" BIGSERIAL NOT NULL,
    "membershipId" BIGINT NOT NULL,
    "jobTitle" TEXT,
    "contractType" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "weeklyHours" INTEGER,
    "hourlyCostCents" BIGINT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMemberPermission" (
    "id" BIGSERIAL NOT NULL,
    "membershipId" BIGINT NOT NULL,
    "permission" "BusinessPermission" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessMemberPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_membershipId_key" ON "EmployeeProfile"("membershipId");

-- CreateIndex
CREATE INDEX "BusinessMemberPermission_permission_idx" ON "BusinessMemberPermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessMemberPermission_membershipId_permission_key" ON "BusinessMemberPermission"("membershipId", "permission");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BusinessMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMemberPermission" ADD CONSTRAINT "BusinessMemberPermission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "BusinessMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
