import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
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

// Reorder (accepts POST or PATCH for flexibility)
async function handleReorder(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; productId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, productId } = await context.params;
  const b = parseId(businessId);
  const p = parseId(productId);
  if (!b || !p) return withIdNoStore(badRequest('Ids invalides.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const membership = await requireBusinessRole(b, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:products:images:reorder:${b}:${p}:${userId}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  const hasArray = Array.isArray(body?.orderedIds);
  const orderedIds = hasArray
    ? (body.orderedIds as unknown[]).filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
    : null;
  if (!orderedIds || orderedIds.length === 0 || orderedIds.length !== (body?.orderedIds?.length ?? 0)) {
    return withIdNoStore(badRequest('orderedIds requis (array de string ids).'), requestId);
  }

  const idList: bigint[] = orderedIds.map((id: string) => BigInt(id));
  const images = await prisma.productImage.findMany({
    where: { businessId: b, productId: p, id: { in: idList } },
    select: { id: true },
  });
  if (images.length !== orderedIds.length) return withIdNoStore(notFound('Images invalides.'), requestId);

  await prisma.$transaction(
    orderedIds.map((id: string, idx: number) =>
      prisma.productImage.update({ where: { id: BigInt(id) }, data: { position: idx } })
    )
  );

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}

export const PATCH = handleReorder;
export const POST = handleReorder;
