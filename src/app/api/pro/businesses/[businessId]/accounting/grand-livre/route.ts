import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { parseDateOpt } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/accounting/grand-livre?from=...&to=...
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { searchParams } = new URL(request.url);

    const fromDate = parseDateOpt(searchParams.get('from'));
    const toDate = parseDateOpt(searchParams.get('to'));

    const MAX_ENTRIES = 5000;
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        businessId: businessIdBigInt,
        ...(fromDate || toDate
          ? {
              date: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      include: { lines: true },
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
      take: MAX_ENTRIES,
    });

    // Group lines by accountCode
    const accounts = new Map<
      string,
      {
        accountCode: string;
        accountName: string;
        lines: Array<{
          date: string;
          journalCode: string | null;
          entryNumber: number | null;
          memo: string | null;
          pieceRef: string | null;
          debitCents: string;
          creditCents: string;
        }>;
        totalDebitCents: bigint;
        totalCreditCents: bigint;
      }
    >();

    for (const entry of entries) {
      for (const line of entry.lines) {
        let acc = accounts.get(line.accountCode);
        if (!acc) {
          acc = {
            accountCode: line.accountCode,
            accountName: line.accountName ?? line.accountCode,
            lines: [],
            totalDebitCents: 0n,
            totalCreditCents: 0n,
          };
          accounts.set(line.accountCode, acc);
        }
        acc.lines.push({
          date: entry.date.toISOString(),
          journalCode: entry.journalCode,
          entryNumber: entry.entryNumber,
          memo: entry.memo,
          pieceRef: entry.pieceRef,
          debitCents: (line.debitCents ?? 0n).toString(),
          creditCents: (line.creditCents ?? 0n).toString(),
        });
        acc.totalDebitCents += line.debitCents ?? 0n;
        acc.totalCreditCents += line.creditCents ?? 0n;
      }
    }

    const result = Array.from(accounts.values())
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
      .map((acc) => ({
        accountCode: acc.accountCode,
        accountName: acc.accountName,
        totalDebitCents: acc.totalDebitCents.toString(),
        totalCreditCents: acc.totalCreditCents.toString(),
        soldeCents: (acc.totalDebitCents - acc.totalCreditCents).toString(),
        lines: acc.lines,
      }));

    return jsonb({ accounts: result }, requestId);
  }
);
