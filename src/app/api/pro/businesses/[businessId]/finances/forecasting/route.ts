import { FinanceType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

function monthKey(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function startOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, count: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
}

// GET /api/pro/businesses/{businessId}/finances/forecasting
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const now = new Date();
    const historyStart = startOfMonth(addMonths(now, -5));

    const rows = await prisma.finance.findMany({
      where: { businessId: businessIdBigInt, deletedAt: null, date: { gte: historyStart, lte: now } },
      select: { date: true, type: true, amountCents: true },
    });

    const historyBuckets = new Map<string, { income: bigint; expense: bigint }>();
    for (let i = 0; i < 6; i += 1) {
      const key = monthKey(addMonths(historyStart, i));
      historyBuckets.set(key, { income: BigInt(0), expense: BigInt(0) });
    }

    for (const row of rows) {
      const key = monthKey(startOfMonth(row.date));
      const bucket = historyBuckets.get(key);
      if (!bucket) continue;
      if (row.type === FinanceType.INCOME) bucket.income += row.amountCents;
      else bucket.expense += row.amountCents;
    }

    const history = Array.from(historyBuckets.entries()).map(([month, vals]) => ({
      month,
      incomeCents: vals.income.toString(),
      expenseCents: vals.expense.toString(),
      netCents: (vals.income - vals.expense).toString(),
    }));

    const last3 = history.slice(-3);
    const avgIncome =
      last3.reduce((acc, m) => acc + BigInt(m.incomeCents), BigInt(0)) / BigInt(last3.length || 1);
    const avgExpense =
      last3.reduce((acc, m) => acc + BigInt(m.expenseCents), BigInt(0)) / BigInt(last3.length || 1);

    const projections = [];
    for (let i = 1; i <= 3; i += 1) {
      const month = monthKey(startOfMonth(addMonths(now, i)));
      projections.push({
        month,
        projectedIncomeCents: avgIncome.toString(),
        projectedExpenseCents: avgExpense.toString(),
        projectedNetCents: (avgIncome - avgExpense).toString(),
      });
    }

    return jsonb({
      businessId: businessIdBigInt.toString(),
      historyRange: { from: historyStart.toISOString(), to: now.toISOString() },
      assumptions: {
        monthsAveraged: last3.length,
        note: 'Projection basée sur la moyenne des 3 derniers mois.',
      },
      history,
      projections,
    }, requestId);
  }
);
