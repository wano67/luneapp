import type { Prisma, PrismaClient, NumberSequenceKind } from '@/generated/prisma';

type TxClient = PrismaClient | Prisma.TransactionClient;

type NumberingType = 'QUOTE' | 'INVOICE';

function buildNumber(prefix: string, sequence: number, year: number) {
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

  const year = (issuedAt ?? new Date()).getFullYear();
  const kind: NumberSequenceKind = type === 'QUOTE' ? 'QUOTE' : 'INVOICE';

  const updated = await tx.numberSequence.upsert({
    where: { businessId_kind_year: { businessId, kind, year } },
    update: { lastNumber: { increment: 1 } },
    create: { businessId, kind, year, lastNumber: 1 },
    select: { lastNumber: true },
  });

  const prefix = type === 'QUOTE' ? 'SF-DEV' : 'SF-FAC';

  return buildNumber(prefix, updated.lastNumber, year);
}
