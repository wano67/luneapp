import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

function parseId(param: unknown) {
  if (typeof param !== 'string' || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withNoStore(withRequestId(csrf, requestId));

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withNoStore(withRequestId(unauthorized(), requestId));
  }

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withNoStore(withRequestId(badRequest('businessId invalide.'), requestId));
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) {
    return withNoStore(withRequestId(badRequest('Forbidden'), requestId));
  }

  const limited = rateLimit(request, {
    key: `pro:clients:bulk:${businessIdBigInt}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return withNoStore(withRequestId(limited, requestId));

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withNoStore(withRequestId(badRequest('Payload invalide.'), requestId));
  }

  const action = (body as { action?: string }).action;
  if (action !== 'ARCHIVE' && action !== 'UNARCHIVE') {
    return withNoStore(withRequestId(badRequest('Action invalide (ARCHIVE|UNARCHIVE).'), requestId));
  }

  const clientIdsRaw = Array.isArray((body as { clientIds?: unknown }).clientIds)
    ? ((body as { clientIds: unknown[] }).clientIds ?? [])
    : [];
  const clientIds = Array.from(
    new Set(
      clientIdsRaw
        .map((id) => parseId(id))
        .filter((id): id is bigint => id !== null)
    )
  );

  if (clientIds.length === 0) {
    return withNoStore(withRequestId(badRequest('clientIds requis.'), requestId));
  }

  const now = new Date();
  const result = await prisma.client.updateMany({
    where: {
      businessId: businessIdBigInt,
      id: { in: clientIds },
    },
    data: {
      archivedAt: action === 'ARCHIVE' ? now : null,
    },
  });

  return withNoStore(
    withRequestId(
      jsonNoStore({
        updatedCount: result.count,
        action,
      }),
      requestId
    )
  );
}
