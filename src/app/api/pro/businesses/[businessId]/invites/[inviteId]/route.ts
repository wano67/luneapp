import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessInviteStatus } from '@/generated/prisma/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
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
  if (limited) return withIdNoStore(limited, requestId);

  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const businessIdBigInt = parseId(businessId);
  const inviteIdBigInt = parseId(inviteId);
  if (!businessIdBigInt || !inviteIdBigInt) {
    return withIdNoStore(badRequest('businessId ou inviteId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withIdNoStore(notFound('Entreprise introuvable.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const invite = await prisma.businessInvite.findUnique({
    where: { id: inviteIdBigInt },
  });

  if (!invite || invite.businessId !== businessIdBigInt) {
    return withIdNoStore(notFound('Invitation non trouvée.'), requestId);
  }

  const now = new Date();
  if (invite.expiresAt && invite.expiresAt < now && invite.status === BusinessInviteStatus.PENDING) {
    await prisma.businessInvite.update({
      where: { id: inviteIdBigInt },
      data: { status: BusinessInviteStatus.EXPIRED },
    });
    return withIdNoStore(jsonNoStore({ error: 'Invitation expirée.' }, { status: 409 }), requestId);
  }

  if (invite.status !== BusinessInviteStatus.PENDING) {
    return withIdNoStore(
      jsonNoStore({ error: 'Invitation déjà utilisée ou révoquée.' }, { status: 409 }),
      requestId
    );
  }

  await prisma.businessInvite.update({
    where: { id: inviteIdBigInt },
    data: { status: BusinessInviteStatus.REVOKED },
  });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
