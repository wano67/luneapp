-- AlterTable
ALTER TABLE "Finance" ADD COLUMN     "inventoryMovementId" BIGINT,
ADD COLUMN     "inventoryProductId" BIGINT;

-- CreateIndex
CREATE UNIQUE INDEX "Finance_inventoryMovementId_key" ON "Finance"("inventoryMovementId");

-- CreateIndex
CREATE INDEX "Finance_businessId_inventoryProductId_idx" ON "Finance"("businessId", "inventoryProductId");

-- AddForeignKey
ALTER TABLE "Finance" ADD CONSTRAINT "Finance_inventoryMovementId_fkey" FOREIGN KEY ("inventoryMovementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finance" ADD CONSTRAINT "Finance_inventoryProductId_fkey" FOREIGN KEY ("inventoryProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

