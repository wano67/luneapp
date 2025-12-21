-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" BIGSERIAL NOT NULL,
    "businessId" BIGINT NOT NULL,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "quotePrefix" TEXT NOT NULL DEFAULT 'DEV-',
    "defaultDepositPercent" INTEGER NOT NULL DEFAULT 30,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "enableAutoNumbering" BOOLEAN NOT NULL DEFAULT true,
    "vatRatePercent" INTEGER NOT NULL DEFAULT 20,
    "vatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowMembersInvite" BOOLEAN NOT NULL DEFAULT true,
    "allowViewerExport" BOOLEAN NOT NULL DEFAULT false,
    "integrationStripeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "integrationStripePublicKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSettings_businessId_key" ON "BusinessSettings"("businessId");

-- AddForeignKey
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
