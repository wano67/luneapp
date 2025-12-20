import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { badRequest, forbidden, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
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
  if (csrf) return withRequestId(csrf, requestId);

  const { businessId: businessIdParam } = await context.params;
  const businessIdBigInt = parseId(businessIdParam);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withRequestId(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: userId
      ? `pro:businesses:leave:${businessIdBigInt}:${userId}`
      : makeIpKey(request, `pro:businesses:leave:${businessIdBigInt}`),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withRequestId(limited, requestId);
  if (membership.role === 'OWNER') {
    return withRequestId(NextResponse.json({ error: 'Un OWNER doit supprimer le business.' }, { status: 400 }), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(NextResponse.json({ error: 'Entreprise introuvable.' }, { status: 404 }), requestId);
  }

  const deleted = await prisma.businessMembership.deleteMany({
    where: { businessId: businessIdBigInt, userId: BigInt(userId) },
  });

  if (deleted.count === 0) {
    return withRequestId(NextResponse.json({ error: 'Membership introuvable.' }, { status: 404 }), requestId);
  }

  return withRequestId(NextResponse.json({ left: true }), requestId);
}
