import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

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

// PATCH /api/pro/businesses/{businessId}/memberships/{membershipId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; membershipId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, membershipId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const membershipIdBigInt = parseId(membershipId);
  if (!businessIdBigInt || !membershipIdBigInt) {
    return withIdNoStore(badRequest('businessId ou membershipId invalide.'), requestId);
  }

  const actorMembership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!actorMembership) return withIdNoStore(forbidden(), requestId);

  const membership = await prisma.businessMembership.findFirst({
    where: { id: membershipIdBigInt, businessId: businessIdBigInt },
    include: { user: { select: { id: true, email: true, name: true } }, organizationUnit: true },
  });
  if (!membership) return withIdNoStore(notFound('Membre introuvable.'), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  if (!('organizationUnitId' in body)) {
    return withIdNoStore(badRequest('organizationUnitId requis.'), requestId);
  }

  const raw = (body as { organizationUnitId?: unknown }).organizationUnitId;
  let organizationUnitId: bigint | null = null;
  if (raw === null || raw === undefined || raw === '') {
    organizationUnitId = null;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    organizationUnitId = BigInt(raw);
    const unit = await prisma.organizationUnit.findFirst({
      where: { id: organizationUnitId, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!unit) return withIdNoStore(badRequest('organizationUnitId invalide.'), requestId);
  } else {
    return withIdNoStore(badRequest('organizationUnitId invalide.'), requestId);
  }

  const updated = await prisma.businessMembership.update({
    where: { id: membershipIdBigInt },
    data: { organizationUnitId },
    include: { user: { select: { id: true, email: true, name: true } }, organizationUnit: true },
  });

  return withIdNoStore(
    jsonNoStore({
      item: {
        membershipId: updated.id.toString(),
        userId: updated.userId.toString(),
        email: updated.user?.email ?? null,
        name: updated.user?.name ?? null,
        role: updated.role,
        organizationUnit: updated.organizationUnit
          ? { id: updated.organizationUnit.id.toString(), name: updated.organizationUnit.name }
          : null,
      },
    }),
    requestId
  );
}
