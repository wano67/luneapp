import { NextRequest, NextResponse } from 'next/server';
import { LedgerSourceType } from '@/generated/prisma/client';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
import { badRequest, forbidden, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function parseId(param: string | null) {
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

function serializeEntry(entry: {
  id: bigint;
  businessId: bigint;
  date: Date;
  memo: string | null;
  sourceType: LedgerSourceType;
  sourceId: bigint | null;
  createdAt: Date;
  lines: { id: bigint; accountCode: string; accountName: string | null; debitCents: bigint | null; creditCents: bigint | null; metadata: unknown; createdAt: Date }[];
}) {
  return {
    id: entry.id.toString(),
    businessId: entry.businessId.toString(),
    date: entry.date.toISOString(),
    memo: entry.memo,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId ? entry.sourceId.toString() : null,
    createdAt: entry.createdAt.toISOString(),
    lines: entry.lines.map((line) => ({
      id: line.id.toString(),
      accountCode: line.accountCode,
      accountName: line.accountName,
      debitCents: line.debitCents ? line.debitCents.toString() : null,
      creditCents: line.creditCents ? line.creditCents.toString() : null,
      metadata: line.metadata ?? null,
      createdAt: line.createdAt.toISOString(),
    })),
  };
}

// GET /api/pro/businesses/{businessId}/ledger
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
  const sourceTypeParam = searchParams.get('sourceType');
  const sourceIdParam = searchParams.get('sourceId');
  const cursorParam = searchParams.get('cursor');
  const limitParam = searchParams.get('limit');

  const fromDate = fromParam ? new Date(fromParam) : null;
  const toDate = toParam ? new Date(toParam) : null;
  if (fromParam && Number.isNaN(fromDate?.getTime() ?? NaN)) {
    return withIdNoStore(badRequest('from invalide.'), requestId);
  }
  if (toParam && Number.isNaN(toDate?.getTime() ?? NaN)) {
    return withIdNoStore(badRequest('to invalide.'), requestId);
  }

  const sourceType = sourceTypeParam && Object.values(LedgerSourceType).includes(sourceTypeParam as LedgerSourceType)
    ? (sourceTypeParam as LedgerSourceType)
    : null;
  const sourceId = parseId(sourceIdParam);
  if (sourceIdParam && !sourceId) {
    return withIdNoStore(badRequest('sourceId invalide.'), requestId);
  }
  const cursor = parseId(cursorParam);
  const take = Math.min(100, Math.max(1, Number(limitParam ?? 50) || 50));

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
      ...(sourceType ? { sourceType } : {}),
      ...(sourceId ? { sourceId } : {}),
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take,
    include: { lines: true },
  });

  return withIdNoStore(
    jsonNoStore({
      items: entries.map(serializeEntry),
      nextCursor: entries.length === take ? entries[entries.length - 1].id.toString() : null,
    }),
    requestId
  );
}
