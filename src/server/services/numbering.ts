import type { Prisma, PrismaClient } from '@/generated/prisma/client';

type TxClient = PrismaClient | Prisma.TransactionClient;

type NumberingType = 'QUOTE' | 'INVOICE';

function buildNumber(prefix: string, sequence: number, issuedAt?: Date | null) {
  const year = (issuedAt ?? new Date()).getFullYear();
  const cleanPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
  return `${cleanPrefix}${year}-${String(sequence).padStart(4, '0')}`;
}

export async function assignDocumentNumber(
  tx: TxClient,
  businessId: bigint,
  type: NumberingType,
  issuedAt?: Date | null
): Promise<string> {
  await tx.businessSettings.upsert({
    where: { businessId },
    update: {},
    create: { businessId },
  });

  if (type === 'QUOTE') {
    const updated = await tx.businessSettings.update({
      where: { businessId },
      data: { nextQuoteNumber: { increment: 1 } },
      select: { nextQuoteNumber: true, quotePrefix: true },
    });
    const seq = updated.nextQuoteNumber - 1;
    return buildNumber(updated.quotePrefix, seq, issuedAt);
  }

  const updated = await tx.businessSettings.update({
    where: { businessId },
    data: { nextInvoiceNumber: { increment: 1 } },
    select: { nextInvoiceNumber: true, invoicePrefix: true },
  });
  const seq = updated.nextInvoiceNumber - 1;
  return buildNumber(updated.invoicePrefix, seq, issuedAt);
}
