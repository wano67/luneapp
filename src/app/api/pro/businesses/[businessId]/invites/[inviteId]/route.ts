import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) {
    return null;
  }
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

// DELETE /api/pro/businesses/{businessId}/invites/{inviteId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; inviteId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, inviteId } = await context.params;

  let userIdForRate: string | null = null;
  try {
    const auth = await requireAuthPro(request);
    userIdForRate = auth.userId;
  } catch {
    userIdForRate = null;
  }
  const limited = rateLimit(request, {
    key: userIdForRate
      ? `pro:invites:delete:${businessId}:${userIdForRate.toString()}`
      : makeIpKey(request, `pro:invites:delete:${businessId}`),
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const businessIdBigInt = parseId(businessId);
  const inviteIdBigInt = parseId(inviteId);
  if (!businessIdBigInt || !inviteIdBigInt) {
    return withRequestId(badRequest('businessId ou inviteId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const invite = await prisma.businessInvite.findUnique({
    where: { id: inviteIdBigInt },
  });

  if (!invite || invite.businessId !== businessIdBigInt) {
    return withRequestId(notFound('Invitation non trouvée.'), requestId);
  }

  await prisma.businessInvite.update({
    where: { id: inviteIdBigInt },
    data: { status: 'REVOKED' },
  });

  return new NextResponse(null, { status: 204 });
}
