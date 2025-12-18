import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
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

// GET /api/pro/businesses/{businessId}/members
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withIdNoStore(notFound('Entreprise introuvable.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) {
    return withIdNoStore(forbidden(), requestId);
  }

  const members = await prisma.businessMembership.findMany({
    where: { businessId: businessIdBigInt },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  return withIdNoStore(
    jsonNoStore({
      items: members.map((m) => ({
        userId: m.userId.toString(),
        email: m.user?.email ?? '',
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
    }),
    requestId
  );
}
