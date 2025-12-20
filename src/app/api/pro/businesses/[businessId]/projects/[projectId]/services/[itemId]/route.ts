import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

async function getItem(businessId: bigint, projectId: bigint, itemId: bigint) {
  return prisma.projectService.findFirst({
    where: {
      id: itemId,
      projectId,
      project: { businessId },
    },
    include: { service: true },
  });
}

// PATCH /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string; itemId: string }> }
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

  const { businessId, projectId, itemId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !projectIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await getItem(businessIdBigInt, projectIdBigInt, itemIdBigInt);
  if (!existing) {
    return withIdNoStore(NextResponse.json({ error: 'Élément introuvable.' }, { status: 404 }), requestId);
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body)) return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const quantity =
    typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? Math.max(1, Math.trunc(body.quantity)) : null;
  const priceCents =
    typeof body.priceCents === 'number' && Number.isFinite(body.priceCents)
      ? Math.max(0, Math.trunc(body.priceCents))
      : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim() : undefined;
  if (notes && notes.length > 2000) return withIdNoStore(badRequest('Notes trop longues.'), requestId);

  const updated = await prisma.projectService.update({
    where: { id: itemIdBigInt },
    data: {
      quantity: quantity ?? undefined,
      priceCents: priceCents ?? undefined,
      notes: notes ?? undefined,
    },
    include: { service: true },
  });

  return withIdNoStore(
    jsonNoStore({
      id: updated.id.toString(),
      projectId: updated.projectId.toString(),
      serviceId: updated.serviceId.toString(),
      quantity: updated.quantity,
      priceCents: updated.priceCents?.toString() ?? null,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      service: {
        id: updated.service.id.toString(),
        code: updated.service.code,
        name: updated.service.name,
        type: updated.service.type,
      },
    }),
    requestId
  );
}

// DELETE /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string; itemId: string }> }
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

  const { businessId, projectId, itemId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !projectIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existing = await getItem(businessIdBigInt, projectIdBigInt, itemIdBigInt);
  if (!existing) {
    return withIdNoStore(NextResponse.json({ error: 'Élément introuvable.' }, { status: 404 }), requestId);
  }

  await prisma.projectService.delete({ where: { id: itemIdBigInt } });
  return withIdNoStore(jsonNoStore({ ok: true }), requestId);
}
