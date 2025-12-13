-- CreateEnum
CREATE TYPE "PersonalAccountType" AS ENUM ('CURRENT', 'SAVINGS', 'INVEST', 'CASH');

-- CreateEnum
CREATE TYPE "PersonalTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- DropIndex
DROP INDEX "Prospect_businessId_idx";

-- CreateTable
CREATE TABLE "PersonalAccount" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PersonalAccountType" NOT NULL DEFAULT 'CURRENT',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "institution" TEXT,
    "iban" TEXT,
    "initialCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalCategory" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalTransaction" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "accountId" BIGINT NOT NULL,
    "categoryId" BIGINT,
    "type" "PersonalTransactionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "label" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalAccount_userId_createdAt_idx" ON "PersonalAccount"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalCategory_userId_name_key" ON "PersonalCategory"("userId", "name");

-- CreateIndex
CREATE INDEX "PersonalTransaction_userId_date_idx" ON "PersonalTransaction"("userId", "date");

-- CreateIndex
CREATE INDEX "PersonalTransaction_accountId_date_idx" ON "PersonalTransaction"("accountId", "date");

-- AddForeignKey
ALTER TABLE "PersonalAccount" ADD CONSTRAINT "PersonalAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCategory" ADD CONSTRAINT "PersonalCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTransaction" ADD CONSTRAINT "PersonalTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTransaction" ADD CONSTRAINT "PersonalTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PersonalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalTransaction" ADD CONSTRAINT "PersonalTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
