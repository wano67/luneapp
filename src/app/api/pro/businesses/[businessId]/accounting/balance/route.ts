import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { parseDateOpt } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/accounting/balance?from=...&to=...
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { searchParams } = new URL(request.url);

    const fromDate = parseDateOpt(searchParams.get('from'));
    const toDate = parseDateOpt(searchParams.get('to'));

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
      include: { lines: { select: { accountCode: true, accountName: true, debitCents: true, creditCents: true } } },
    });

    const accounts = new Map<
      string,
      { accountName: string; totalDebit: bigint; totalCredit: bigint }
    >();

    for (const entry of entries) {
      for (const line of entry.lines) {
        let acc = accounts.get(line.accountCode);
        if (!acc) {
          acc = { accountName: line.accountName ?? line.accountCode, totalDebit: 0n, totalCredit: 0n };
          accounts.set(line.accountCode, acc);
        }
        acc.totalDebit += line.debitCents ?? 0n;
        acc.totalCredit += line.creditCents ?? 0n;
      }
    }

    let grandTotalDebit = 0n;
    let grandTotalCredit = 0n;

    const result = Array.from(accounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, acc]) => {
        grandTotalDebit += acc.totalDebit;
        grandTotalCredit += acc.totalCredit;
        const solde = acc.totalDebit - acc.totalCredit;
        return {
          accountCode: code,
          accountName: acc.accountName,
          totalDebitCents: acc.totalDebit.toString(),
          totalCreditCents: acc.totalCredit.toString(),
          soldeDebiteurCents: solde > 0n ? solde.toString() : '0',
          soldeCrediteurCents: solde < 0n ? (-solde).toString() : '0',
        };
      });

    return jsonb(
      {
        accounts: result,
        totalDebitCents: grandTotalDebit.toString(),
        totalCreditCents: grandTotalCredit.toString(),
        isBalanced: grandTotalDebit === grandTotalCredit,
      },
      requestId
    );
  }
);
