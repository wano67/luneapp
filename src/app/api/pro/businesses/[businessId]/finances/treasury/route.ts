import { FinanceType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';

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

// GET /api/pro/businesses/{businessId}/finances/treasury
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const end = toParam ? new Date(toParam) : new Date();
    if (Number.isNaN(end.getTime())) return withIdNoStore(badRequest('to invalide.'), requestId);
    const start = fromParam
      ? new Date(fromParam)
      : startOfMonth(addMonths(end, -11));
    if (Number.isNaN(start.getTime())) return withIdNoStore(badRequest('from invalide.'), requestId);

    const finances = await prisma.finance.findMany({
      where: {
        businessId: businessIdBigInt,
        deletedAt: null,
        date: { gte: start, lte: end },
      },
      select: { date: true, type: true, amountCents: true, category: true },
    });

    const buckets = new Map<string, { income: bigint; expense: bigint }>();
    for (let i = 0; i < 12; i += 1) {
      const key = monthKey(addMonths(startOfMonth(start), i));
      buckets.set(key, { income: BigInt(0), expense: BigInt(0) });
    }

    let incomeTotal = BigInt(0);
    let expenseTotal = BigInt(0);
    const categoryMap = new Map<string, bigint>();

    for (const row of finances) {
      const key = monthKey(startOfMonth(row.date));
      const bucket = buckets.get(key);
      const isIncome = row.type === FinanceType.INCOME;
      const amount = row.amountCents;
      if (bucket) {
        if (isIncome) bucket.income += amount;
        else bucket.expense += amount;
      }
      if (isIncome) incomeTotal += amount;
      else expenseTotal += amount;

      if (row.category) {
        const prev = categoryMap.get(row.category) ?? BigInt(0);
        categoryMap.set(row.category, prev + (isIncome ? amount : -amount));
      }
    }

    const monthly = Array.from(buckets.entries()).map(([month, vals]) => ({
      month,
      incomeCents: vals.income.toString(),
      expenseCents: vals.expense.toString(),
      netCents: (vals.income - vals.expense).toString(),
    }));

    const byCategory = Array.from(categoryMap.entries())
      .sort((a, b) => Number(BigInt(b[1]) - BigInt(a[1])))
      .slice(0, 10)
      .map(([category, net]) => ({ category, netCents: net.toString() }));

    return jsonb({
      businessId: businessIdBigInt.toString(),
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: {
        incomeCents: incomeTotal.toString(),
        expenseCents: expenseTotal.toString(),
        netCents: (incomeTotal - expenseTotal).toString(),
      },
      monthly,
      byCategory,
    }, requestId);
  }
);
