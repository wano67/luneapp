import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { AUTH_COOKIE_NAME } from '@/server/auth/auth.service';
import { verifyAuthToken } from '@/server/auth/jwt';

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

async function requireAdminOrOwner(businessId: bigint, userId: bigint) {
  const membership = await prisma.businessMembership.findUnique({
    where: {
      businessId_userId: { businessId, userId },
    },
  });

  if (!membership) return null;
  if (membership.role === 'OWNER' || membership.role === 'ADMIN') {
    return membership;
  }
  return null;
}

// DELETE /api/pro/businesses/{businessId}/invites/{inviteId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; inviteId: string }> }
) {
  const { businessId, inviteId } = await context.params;

  const businessIdBigInt = parseId(businessId);
  const inviteIdBigInt = parseId(inviteId);
  if (!businessIdBigInt || !inviteIdBigInt) {
    return badRequest('businessId ou inviteId invalide.');
  }

  const userId = await getUserId(request);
  if (!userId) return unauthorized();

  const membership = await requireAdminOrOwner(businessIdBigInt, userId);
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
