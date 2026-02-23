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

// PATCH /api/pro/businesses/{businessId}/organization/units/{unitId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; unitId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, unitId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const unitIdBigInt = parseId(unitId);
  if (!businessIdBigInt || !unitIdBigInt) {
    return withIdNoStore(badRequest('businessId ou unitId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const unit = await prisma.organizationUnit.findFirst({
    where: { id: unitIdBigInt, businessId: businessIdBigInt },
  });
  if (!unit) return withIdNoStore(notFound('Pôle introuvable.'), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: { name?: string; order?: number } = {};
  if ('name' in body) {
    const nameRaw = (body as { name?: unknown }).name;
    if (typeof nameRaw !== 'string') return withIdNoStore(badRequest('name invalide.'), requestId);
    const name = nameRaw.trim();
    if (!name) return withIdNoStore(badRequest('name requis.'), requestId);
    if (name.length > 80) return withIdNoStore(badRequest('name trop long (80 max).'), requestId);
    const existing = await prisma.organizationUnit.findFirst({
      where: { businessId: businessIdBigInt, name, NOT: { id: unitIdBigInt } },
      select: { id: true },
    });
    if (existing) {
      return withIdNoStore(badRequest('Un pôle avec ce nom existe déjà.'), requestId);
    }
    data.name = name;
  }

  if ('order' in body) {
    const orderRaw = (body as { order?: unknown }).order;
    if (typeof orderRaw !== 'number' || !Number.isFinite(orderRaw)) {
      return withIdNoStore(badRequest('order invalide.'), requestId);
    }
    data.order = Math.trunc(orderRaw);
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.organizationUnit.update({
    where: { id: unitIdBigInt },
    data,
  });

  return withIdNoStore(
    jsonNoStore({
      item: {
        id: updated.id.toString(),
        name: updated.name,
        order: updated.order,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    }),
    requestId
  );
}

// DELETE /api/pro/businesses/{businessId}/organization/units/{unitId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; unitId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, unitId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const unitIdBigInt = parseId(unitId);
  if (!businessIdBigInt || !unitIdBigInt) {
    return withIdNoStore(badRequest('businessId ou unitId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const unit = await prisma.organizationUnit.findFirst({
    where: { id: unitIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!unit) return withIdNoStore(notFound('Pôle introuvable.'), requestId);

  const assignedCount = await prisma.businessMembership.count({
    where: { organizationUnitId: unitIdBigInt, businessId: businessIdBigInt },
  });
  if (assignedCount > 0) {
    return withIdNoStore(badRequest('Des membres sont assignés à ce pôle.'), requestId);
  }

  await prisma.organizationUnit.delete({ where: { id: unitIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
