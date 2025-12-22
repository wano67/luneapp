import { NextRequest, NextResponse } from 'next/server';
import { LedgerSourceType } from '@/generated/prisma/client';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
import { badRequest, forbidden, getRequestId, notFound, unauthorized, withRequestId } from '@/server/http/apiUtils';

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

// GET /api/pro/businesses/{businessId}/ledger/{entryId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; entryId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, entryId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const entryIdBigInt = parseId(entryId);
  if (!businessIdBigInt || !entryIdBigInt) return withIdNoStore(badRequest('IDs invalides.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const entry = await prisma.ledgerEntry.findFirst({
    where: { id: entryIdBigInt, businessId: businessIdBigInt },
    include: { lines: true },
  });
  if (!entry) return withIdNoStore(notFound('Écriture introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ item: serializeEntry(entry) }), requestId);
}
