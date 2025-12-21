import { NextRequest, NextResponse } from 'next/server';
import { BusinessReferenceType } from '@/generated/prisma/client';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
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

function isValidType(value: unknown): value is BusinessReferenceType {
  return Object.values(BusinessReferenceType).includes(value as BusinessReferenceType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function serializeReference(reference: {
  id: bigint;
  businessId: bigint;
  type: BusinessReferenceType;
  name: string;
  value: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: reference.id.toString(),
    businessId: reference.businessId.toString(),
    type: reference.type,
    name: reference.name,
    value: reference.value,
    isArchived: reference.isArchived,
    createdAt: reference.createdAt.toISOString(),
    updatedAt: reference.updatedAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/references
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');
  const search = (searchParams.get('search') || searchParams.get('q') || '').trim();
  const includeArchived = searchParams.get('includeArchived') === 'true';

  const typeFilter =
    typeParam && isValidType(typeParam.toUpperCase() as BusinessReferenceType)
      ? ((typeParam.toUpperCase() as BusinessReferenceType) ?? null)
      : null;

  const references = await prisma.businessReference.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
      ...(includeArchived ? {} : { isArchived: false }),
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  return withIdNoStore(jsonNoStore({ items: references.map(serializeReference) }), requestId);
}

// POST /api/pro/businesses/{businessId}/references
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:references:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const typeRaw = typeof body.type === 'string' ? body.type.toUpperCase().trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const value =
    typeof body.value === 'string' || typeof body.value === 'number'
      ? String(body.value).trim()
      : null;

  if (!isValidType(typeRaw as BusinessReferenceType)) {
    return withIdNoStore(badRequest('Type invalide.'), requestId);
  }
  if (!name) return withIdNoStore(badRequest('Nom requis.'), requestId);
  if (name.length > 140) return withIdNoStore(badRequest('Nom trop long (140 max).'), requestId);
  if (value && value.length > 500) {
    return withIdNoStore(badRequest('Valeur trop longue (500 max).'), requestId);
  }

  try {
    const created = await prisma.businessReference.create({
      data: {
        businessId: businessIdBigInt,
        type: typeRaw as BusinessReferenceType,
        name,
        value: value || null,
      },
    });

    return withIdNoStore(
      NextResponse.json({ item: serializeReference(created) }, { status: 201 }),
      requestId
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Unique constraint')
        ? 'Un élément avec ce nom existe déjà.'
        : 'Création impossible.';
    return withIdNoStore(badRequest(message), requestId);
  }
}
