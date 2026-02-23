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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function startOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function monthKey(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

// GET /api/pro/businesses/{businessId}/finances/vat
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
  const months = Number(searchParams.get('months') ?? 6);
  const end = new Date();
  const start = startOfMonth(new Date());
  start.setMonth(start.getMonth() - (Number.isFinite(months) && months > 0 ? months - 1 : 5));

  const finances = await prisma.finance.findMany({
    where: {
      businessId: businessIdBigInt,
      deletedAt: null,
      date: { gte: start, lte: end },
      category: { in: ['VAT_COLLECTED', 'VAT_PAID'] },
    },
    select: { date: true, type: true, amountCents: true, category: true },
  });

  const configured = finances.length > 0;
  const buckets = new Map<string, { collected: bigint; deductible: bigint }>();
  for (let i = 0; i < 6; i += 1) {
    const key = monthKey(startOfMonth(new Date(start.getFullYear(), start.getMonth() + i, 1)));
    buckets.set(key, { collected: BigInt(0), deductible: BigInt(0) });
  }

  let collectedTotal = BigInt(0);
  let deductibleTotal = BigInt(0);

  for (const row of finances) {
    const key = buckets.get(monthKey(startOfMonth(row.date)));
    const amount = row.amountCents;
    const isCollected = row.category === 'VAT_COLLECTED' || row.type === FinanceType.INCOME;
    if (isCollected) {
      collectedTotal += amount;
      if (key) key.collected += amount;
    } else {
      deductibleTotal += amount;
      if (key) key.deductible += amount;
    }
  }

  const monthly = Array.from(buckets.entries()).map(([month, vals]) => ({
    month,
    collectedCents: vals.collected.toString(),
    deductibleCents: vals.deductible.toString(),
    balanceCents: (vals.collected - vals.deductible).toString(),
  }));

  return withIdNoStore(
    jsonNoStore({
      businessId: businessIdBigInt.toString(),
      range: { from: start.toISOString(), to: end.toISOString() },
      isConfigured: configured,
      totals: {
        collectedCents: collectedTotal.toString(),
        deductibleCents: deductibleTotal.toString(),
        balanceCents: (collectedTotal - deductibleTotal).toString(),
      },
      monthly,
      message: configured ? null : 'Aucune écriture TVA détectée (categories VAT_COLLECTED / VAT_PAID).',
    }),
    requestId
  );
}
