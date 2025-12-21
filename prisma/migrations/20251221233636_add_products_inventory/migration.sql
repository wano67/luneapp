-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('PIECE', 'KG', 'HOUR', 'LITER', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "InventoryMovementSource" AS ENUM ('MANUAL', 'PURCHASE', 'SALE');

-- CreateTable
CREATE TABLE "Product" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "sku" TEXT NOT NULL,
    "skuLower" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" "ProductUnit" NOT NULL DEFAULT 'PIECE',
    "salePriceCents" BIGINT,
    "purchasePriceCents" BIGINT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "source" "InventoryMovementSource" NOT NULL DEFAULT 'MANUAL',
    "quantity" INTEGER NOT NULL,
    "unitCostCents" BIGINT,
    "reason" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdByUserId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Product_businessId_isArchived_idx" ON "Product"("businessId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "Product_businessId_skuLower_key" ON "Product"("businessId", "skuLower");

-- CreateIndex
CREATE INDEX "InventoryMovement_businessId_productId_idx" ON "InventoryMovement"("businessId", "productId");

-- CreateIndex
CREATE INDEX "InventoryMovement_businessId_date_idx" ON "InventoryMovement"("businessId", "date");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
