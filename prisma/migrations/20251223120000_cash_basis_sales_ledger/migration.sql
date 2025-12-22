-- AlterEnum
ALTER TYPE "LedgerSourceType" ADD VALUE 'INVOICE_CASH_SALE';

-- AlterTable
ALTER TABLE "BusinessSettings"
ADD COLUMN     "ledgerSalesAccountCode" TEXT NOT NULL DEFAULT '706',
ADD COLUMN     "ledgerVatCollectedAccountCode" TEXT NOT NULL DEFAULT '44571',
ADD COLUMN     "ledgerCashAccountCode" TEXT NOT NULL DEFAULT '512';
