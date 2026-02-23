import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import {
  badRequest,
  forbidden,
  getRequestId,
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

// GET /api/pro/businesses/{businessId}/organization/units
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
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const units = await prisma.organizationUnit.findMany({
    where: { businessId: businessIdBigInt },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });

  return withIdNoStore(
    jsonNoStore({
      items: units.map((unit) => ({
        id: unit.id.toString(),
        name: unit.name,
        order: unit.order,
        createdAt: unit.createdAt.toISOString(),
        updatedAt: unit.updatedAt.toISOString(),
      })),
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/organization/units
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const nameRaw = (body as { name?: unknown }).name;
  if (typeof nameRaw !== 'string') {
    return withIdNoStore(badRequest('name requis.'), requestId);
  }
  const name = nameRaw.trim();
  if (!name) return withIdNoStore(badRequest('name requis.'), requestId);
  if (name.length > 80) return withIdNoStore(badRequest('name trop long (80 max).'), requestId);

  const orderRaw = (body as { order?: unknown }).order;
  const order =
    typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? Math.trunc(orderRaw) : 0;

  const existing = await prisma.organizationUnit.findFirst({
    where: { businessId: businessIdBigInt, name },
    select: { id: true },
  });
  if (existing) {
    return withIdNoStore(badRequest('Un pôle avec ce nom existe déjà.'), requestId);
  }

  const created = await prisma.organizationUnit.create({
    data: { businessId: businessIdBigInt, name, order },
  });

  return withIdNoStore(
    jsonNoStore(
      {
        item: {
          id: created.id.toString(),
          name: created.name,
          order: created.order,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    ),
    requestId
  );
}
