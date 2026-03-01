-- CreateEnum
CREATE TYPE "ServiceUnit" AS ENUM ('FORFAIT', 'HOUR', 'DAY', 'PIECE', 'OTHER');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN "unit" "ServiceUnit" NOT NULL DEFAULT 'FORFAIT',
ADD COLUMN "costCents" BIGINT,
ADD COLUMN "defaultQuantity" INTEGER NOT NULL DEFAULT 1;
