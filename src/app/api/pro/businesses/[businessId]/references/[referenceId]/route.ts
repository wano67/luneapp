import { NextRequest, NextResponse } from 'next/server';
import { BusinessReferenceType } from '@/generated/prisma';
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

async function getReference(businessId: bigint, referenceId: bigint) {
  return prisma.businessReference.findFirst({
    where: { id: referenceId, businessId },
  });
}

// PATCH /api/pro/businesses/{businessId}/references/{referenceId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; referenceId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, referenceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const referenceIdBigInt = parseId(referenceId);
  if (!businessIdBigInt || !referenceIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:references:update:${businessIdBigInt}:${referenceIdBigInt}:${userId}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const name =
    body.name === undefined
      ? undefined
      : typeof body.name === 'string'
        ? body.name.trim()
        : null;
  const value =
    body.value === undefined
      ? undefined
      : typeof body.value === 'string' || typeof body.value === 'number'
        ? String(body.value).trim()
        : null;
  const isArchived =
    body.isArchived === undefined ? undefined : Boolean(body.isArchived === true || body.isArchived === 'true');

  if (name !== undefined) {
    if (name === null || !name) return withIdNoStore(badRequest('Nom requis.'), requestId);
    if (name.length > 140) return withIdNoStore(badRequest('Nom trop long (140 max).'), requestId);
  }
  if (value !== undefined && value && value.length > 500) {
    return withIdNoStore(badRequest('Valeur trop longue (500 max).'), requestId);
  }

  const existing = await getReference(businessIdBigInt, referenceIdBigInt);
  if (!existing) return withIdNoStore(notFound('Référence introuvable.'), requestId);

  try {
    const updated = await prisma.businessReference.update({
      where: { id: referenceIdBigInt },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(value !== undefined ? { value: value || null } : {}),
        ...(isArchived !== undefined ? { isArchived } : {}),
      },
    });

    return withIdNoStore(jsonNoStore({ item: serializeReference(updated) }), requestId);
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes('Unique constraint')
        ? 'Un élément avec ce nom existe déjà.'
        : 'Mise à jour impossible.';
    return withIdNoStore(badRequest(message), requestId);
  }
}

// DELETE /api/pro/businesses/{businessId}/references/{referenceId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; referenceId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, referenceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const referenceIdBigInt = parseId(referenceId);
  if (!businessIdBigInt || !referenceIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:references:delete:${businessIdBigInt}:${referenceIdBigInt}:${userId}`,
    limit: 100,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await getReference(businessIdBigInt, referenceIdBigInt);
  if (!existing) return withIdNoStore(notFound('Référence introuvable.'), requestId);

  await prisma.businessReference.delete({ where: { id: referenceIdBigInt } });

  return withIdNoStore(NextResponse.json({ ok: true }, { status: 200 }), requestId);
}
