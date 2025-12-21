import { NextRequest, NextResponse } from 'next/server';
import { FinanceType } from '@/generated/prisma/client';
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

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const end = toParam ? new Date(toParam) : new Date();
  if (Number.isNaN(end.getTime())) return withIdNoStore(badRequest('to invalide.'), requestId);
  const start = fromParam
    ? new Date(fromParam)
    : startOfMonth(addMonths(end, -11)); // 12 months window by default
  if (Number.isNaN(start.getTime())) return withIdNoStore(badRequest('from invalide.'), requestId);

  const finances = await prisma.finance.findMany({
    where: {
      businessId: businessIdBigInt,
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

  return withIdNoStore(
    jsonNoStore({
      businessId: businessIdBigInt.toString(),
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: {
        incomeCents: incomeTotal.toString(),
        expenseCents: expenseTotal.toString(),
        netCents: (incomeTotal - expenseTotal).toString(),
      },
      monthly,
      byCategory,
    }),
    requestId
  );
}
