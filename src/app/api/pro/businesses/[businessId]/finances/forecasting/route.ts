import { NextRequest, NextResponse } from 'next/server';
import { FinanceType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
import { badRequest, forbidden, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

// GET /api/pro/businesses/{businessId}/finances/forecasting
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const now = new Date();
  const historyStart = startOfMonth(addMonths(now, -5)); // 6 months history

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

  // Average over last 3 months
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

  return withIdNoStore(
    jsonNoStore({
      businessId: businessIdBigInt.toString(),
      historyRange: { from: historyStart.toISOString(), to: now.toISOString() },
      assumptions: {
        monthsAveraged: last3.length,
        note: 'Projection basée sur la moyenne des 3 derniers mois.',
      },
      history,
      projections,
    }),
    requestId
  );
}
