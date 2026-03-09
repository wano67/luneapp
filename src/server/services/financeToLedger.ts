import { LedgerSourceType, Prisma } from '@/generated/prisma';
import { findCategoryByCode, TVA_ACCOUNTS, BANK_ACCOUNT } from '@/config/pcg';

type TxClient = Prisma.TransactionClient;

/**
 * Assigns a sequential ledger entry number per business/year.
 */
async function nextEntryNumber(tx: TxClient, businessId: bigint, date: Date): Promise<number> {
  const year = date.getFullYear();
  const updated = await tx.numberSequence.upsert({
    where: { businessId_kind_year: { businessId, kind: 'LEDGER', year } },
    update: { lastNumber: { increment: 1 } },
    create: { businessId, kind: 'LEDGER', year, lastNumber: 1 },
    select: { lastNumber: true },
  });
  return updated.lastNumber;
}

/**
 * Creates or updates a LedgerEntry for a Finance record.
 *
 * For EXPENSE:
 *   Debit  {accountCode} (charge account)  = HT
 *   Debit  44566 (TVA déductible)           = TVA (if > 0)
 *   Credit 512   (Banque)                   = TTC
 *
 * For INCOME:
 *   Debit  512   (Banque)                   = TTC
 *   Credit {accountCode} (revenue account)  = HT
 *   Credit 44571 (TVA collectée)            = TVA (if > 0)
 */
export async function upsertLedgerForFinance(
  tx: TxClient,
  finance: {
    id: bigint;
    businessId: bigint;
    type: 'INCOME' | 'EXPENSE';
    amountCents: bigint;
    accountCode: string | null;
    vatRate: number | null;
    vatCents: bigint | null;
    pieceRef: string | null;
    category: string;
    vendor: string | null;
    date: Date;
  }
) {
  if (!finance.accountCode) return null;

  const pcg = findCategoryByCode(finance.accountCode);
  const journalCode = pcg?.journalCode ?? 'OD';
  const accountName = pcg?.label ?? finance.category;

  const ttc = finance.amountCents;
  const tva = finance.vatCents ?? 0n;
  const ht = ttc - tva;

  const memo = finance.vendor
    ? `${finance.category} — ${finance.vendor}`
    : finance.category;

  const lines: Array<{
    accountCode: string;
    accountName: string | null;
    debitCents?: bigint;
    creditCents?: bigint;
  }> = [];

  if (finance.type === 'EXPENSE') {
    lines.push({ accountCode: finance.accountCode, accountName, debitCents: ht });
    if (tva > 0n) {
      lines.push({ accountCode: TVA_ACCOUNTS.DEDUCTIBLE, accountName: 'TVA déductible', debitCents: tva });
    }
    lines.push({ accountCode: BANK_ACCOUNT, accountName: 'Banque', creditCents: ttc });
  } else {
    lines.push({ accountCode: BANK_ACCOUNT, accountName: 'Banque', debitCents: ttc });
    lines.push({ accountCode: finance.accountCode, accountName, creditCents: ht });
    if (tva > 0n) {
      lines.push({ accountCode: TVA_ACCOUNTS.COLLECTEE, accountName: 'TVA collectée', creditCents: tva });
    }
  }

  // Balance check
  const totalDebit = lines.reduce((s, l) => s + (l.debitCents ?? 0n), 0n);
  const totalCredit = lines.reduce((s, l) => s + (l.creditCents ?? 0n), 0n);
  if (totalDebit !== totalCredit) {
    throw new Error(`Ledger not balanced: debit=${totalDebit} credit=${totalCredit}`);
  }

  const existing = await tx.ledgerEntry.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: LedgerSourceType.FINANCE_ENTRY,
        sourceId: finance.id,
      },
    },
  });

  if (existing) {
    // Update existing entry
    await tx.ledgerEntry.update({
      where: { id: existing.id },
      data: {
        date: finance.date,
        memo,
        journalCode,
        pieceRef: finance.pieceRef,
        pieceDate: finance.date,
        validDate: new Date(),
      },
    });
    await tx.ledgerLine.deleteMany({ where: { entryId: existing.id } });
    await tx.ledgerLine.createMany({
      data: lines.map((l) => ({
        entryId: existing.id,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debitCents: l.debitCents ?? undefined,
        creditCents: l.creditCents ?? undefined,
      })),
    });
    return existing;
  }

  // Create new entry
  const entryNumber = await nextEntryNumber(tx, finance.businessId, finance.date);
  const entry = await tx.ledgerEntry.create({
    data: {
      businessId: finance.businessId,
      date: finance.date,
      memo,
      sourceType: LedgerSourceType.FINANCE_ENTRY,
      sourceId: finance.id,
      journalCode,
      entryNumber,
      pieceRef: finance.pieceRef,
      pieceDate: finance.date,
      validDate: new Date(),
    },
  });
  await tx.ledgerLine.createMany({
    data: lines.map((l) => ({
      entryId: entry.id,
      accountCode: l.accountCode,
      accountName: l.accountName,
      debitCents: l.debitCents ?? undefined,
      creditCents: l.creditCents ?? undefined,
    })),
  });
  return entry;
}

/**
 * Deletes the LedgerEntry associated with a Finance record.
 */
export async function deleteLedgerForFinance(tx: TxClient, financeId: bigint) {
  const entry = await tx.ledgerEntry.findUnique({
    where: {
      sourceType_sourceId: {
        sourceType: LedgerSourceType.FINANCE_ENTRY,
        sourceId: financeId,
      },
    },
  });
  if (!entry) return;
  await tx.ledgerLine.deleteMany({ where: { entryId: entry.id } });
  await tx.ledgerEntry.delete({ where: { id: entry.id } });
}
