import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore } from '@/server/security/csrf';
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
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withRequestId(forbidden(), requestId);

  const business = await prisma.business.findUnique({
    where: { id: businessIdBigInt },
  });

  if (!business) {
    return withRequestId(notFound('Entreprise introuvable.'), requestId);
  }

  return jsonNoStore({
    id: business.id.toString(),
    name: business.name,
    ownerId: business.ownerId.toString(),
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
    role: membership.role,
  });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  const { businessId: businessIdParam } = await context.params;
  const businessIdBigInt = parseId(businessIdParam);
  if (!businessIdBigInt) return withRequestId(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'OWNER');
  if (!membership) return withRequestId(forbidden(), requestId);

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) {
    return withRequestId(notFound('Entreprise introuvable.'), requestId);
  }

  await prisma.$transaction([
    prisma.businessInvite.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.businessMembership.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.prospect.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.client.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.project.deleteMany({ where: { businessId: businessIdBigInt } }),
    prisma.business.delete({ where: { id: businessIdBigInt } }),
  ]);

  return withRequestId(NextResponse.json({ deleted: true }), requestId);
}
