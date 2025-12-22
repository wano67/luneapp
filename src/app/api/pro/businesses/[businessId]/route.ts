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
import { rateLimit } from '@/server/security/rateLimit';
import { normalizeWebsiteUrl } from '@/lib/website';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function serializeBusiness(business: {
  id: bigint;
  name: string;
  websiteUrl: string | null;
  ownerId: bigint;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: business.id.toString(),
    name: business.name,
    websiteUrl: business.websiteUrl,
    ownerId: business.ownerId.toString(),
    createdAt: business.createdAt.toISOString(),
    updatedAt: business.updatedAt.toISOString(),
  };
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
    ...serializeBusiness(business),
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

export async function PATCH(
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

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withRequestId(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:business:update:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withRequestId(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withRequestId(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    if (typeof (body as Record<string, unknown>).name !== 'string') {
      return withRequestId(badRequest('Nom invalide.'), requestId);
    }
    const name = (body as Record<string, unknown>).name?.toString().trim();
    if (!name) return withRequestId(badRequest('Nom requis.'), requestId);
    if (name.length > 200) return withRequestId(badRequest('Nom trop long (200 max).'), requestId);
    data.name = name;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'websiteUrl')) {
    const normalizedWebsite = normalizeWebsiteUrl((body as Record<string, unknown>).websiteUrl);
    if (normalizedWebsite.error) {
      return withRequestId(badRequest(normalizedWebsite.error), requestId);
    }
    data.websiteUrl = normalizedWebsite.value;
  }

  if (Object.keys(data).length === 0) {
    return withRequestId(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.business.update({
    where: { id: businessIdBigInt },
    data,
  });

  return withRequestId(jsonNoStore({ item: serializeBusiness(updated) }), requestId);
}
