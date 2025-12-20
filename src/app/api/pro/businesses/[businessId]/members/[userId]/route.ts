import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

type BusinessRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

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

function isValidRole(role: unknown): role is BusinessRole {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MEMBER' || role === 'VIEWER';
}

function isAdmin(actorRole: BusinessRole) {
  return actorRole === 'ADMIN' || actorRole === 'OWNER';
}

function actorCanManageRole(actorRole: BusinessRole, targetRole: BusinessRole, nextRole: BusinessRole) {
  if (!isAdmin(actorRole)) return false;
  if (nextRole === 'OWNER') return false; // on ne permet pas de transférer l’ownership ici
  if (targetRole === 'OWNER') return false; // impossible de toucher à un OWNER

  if (actorRole === 'OWNER') return true;

  // ADMIN : seulement sur MEMBER / VIEWER, et vers MEMBER / VIEWER
  const manageable = targetRole === 'MEMBER' || targetRole === 'VIEWER';
  const nextAllowed = nextRole === 'MEMBER' || nextRole === 'VIEWER';
  return manageable && nextAllowed;
}

function actorCanRemove(actorRole: BusinessRole, targetRole: BusinessRole) {
  if (!isAdmin(actorRole)) return false;
  if (targetRole === 'OWNER') return false;
  if (actorRole === 'OWNER') return true;
  return targetRole === 'MEMBER' || targetRole === 'VIEWER';
}

// PATCH /api/pro/businesses/{businessId}/members/{userId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; userId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, userId: userIdParam } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const targetUserId = parseId(userIdParam);
  if (!businessIdBigInt || !targetUserId) {
    return withIdNoStore(badRequest('businessId ou userId invalide.'), requestId);
  }

  let actorId: string;
  try {
    ({ userId: actorId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const actorMembership = await requireBusinessRole(businessIdBigInt, BigInt(actorId), 'ADMIN');
  if (!actorMembership) {
    return withIdNoStore(forbidden(), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:members:update:${businessIdBigInt}:${actorId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const targetMembership = await prisma.businessMembership.findUnique({
    where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
    include: { user: { select: { email: true } } },
  });
  if (!targetMembership) {
    return withIdNoStore(notFound('Membre introuvable.'), requestId);
  }

  if (targetMembership.businessId !== businessIdBigInt) {
    return withIdNoStore(notFound('Membre introuvable.'), requestId);
  }

  if (targetMembership.userId.toString() === actorId) {
    return withIdNoStore(badRequest('Impossible de modifier ton propre rôle.'), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!body || !isValidRole(body.role)) {
    return withIdNoStore(badRequest('Rôle invalide.'), requestId);
  }

  const nextRole = body.role;
  if (!actorCanManageRole(actorMembership.role, targetMembership.role, nextRole)) {
    return withIdNoStore(forbidden(), requestId);
  }

  if (nextRole === targetMembership.role) {
    return withIdNoStore(
      jsonNoStore(
        {
          userId: targetMembership.userId.toString(),
          email: targetMembership.user?.email ?? '',
          role: targetMembership.role,
          createdAt: targetMembership.createdAt.toISOString(),
        },
        { status: 200 }
      ),
      requestId
    );
  }

  const updated = await prisma.businessMembership.update({
    where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
    data: { role: nextRole },
    include: { user: { select: { email: true } } },
  });

  return withIdNoStore(
    jsonNoStore({
      userId: updated.userId.toString(),
      email: updated.user?.email ?? '',
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
    }),
    requestId
  );
}

// DELETE /api/pro/businesses/{businessId}/members/{userId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; userId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, userId: userIdParam } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const targetUserId = parseId(userIdParam);
  if (!businessIdBigInt || !targetUserId) {
    return withIdNoStore(badRequest('businessId ou userId invalide.'), requestId);
  }

  let actorId: string;
  try {
    ({ userId: actorId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const actorMembership = await requireBusinessRole(businessIdBigInt, BigInt(actorId), 'ADMIN');
  if (!actorMembership) {
    return withIdNoStore(forbidden(), requestId);
  }

  const limited = rateLimit(request, {
    key: `pro:members:delete:${businessIdBigInt}:${actorId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const targetMembership = await prisma.businessMembership.findUnique({
    where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
    include: { user: { select: { email: true } } },
  });
  if (!targetMembership || targetMembership.businessId !== businessIdBigInt) {
    return withIdNoStore(notFound('Membre introuvable.'), requestId);
  }

  if (targetMembership.userId.toString() === actorId) {
    return withIdNoStore(badRequest('Impossible de te retirer via cette action.'), requestId);
  }

  if (!actorCanRemove(actorMembership.role, targetMembership.role)) {
    return withIdNoStore(forbidden(), requestId);
  }

  await prisma.businessMembership.delete({
    where: { businessId_userId: { businessId: businessIdBigInt, userId: targetUserId } },
  });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
