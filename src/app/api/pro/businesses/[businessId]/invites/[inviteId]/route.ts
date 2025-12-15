import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

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

async function getUserId(request: NextRequest): Promise<bigint | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await verifyAuthToken(token);
    if (!payload.sub) return null;
    return BigInt(payload.sub);
  } catch {
    return null;
  }
}

// DELETE /api/pro/businesses/{businessId}/invites/{inviteId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; inviteId: string }> }
) {
  const { businessId, inviteId } = await context.params;

  const userIdForRate = await getUserId(request);
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
    return badRequest('businessId ou inviteId invalide.');
  }

  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const membership = await requireBusinessRole(businessIdBigInt, userId, 'ADMIN');
  if (!membership) return forbidden();

  const invite = await prisma.businessInvite.findUnique({
    where: { id: inviteIdBigInt },
  });

  if (!invite || invite.businessId !== businessIdBigInt) {
    return NextResponse.json(
      { error: 'Invitation non trouvée.' },
      { status: 404 }
    );
  }

  await prisma.businessInvite.update({
    where: { id: inviteIdBigInt },
    data: { status: 'REVOKED' },
  });

  return new NextResponse(null, { status: 204 });
}
