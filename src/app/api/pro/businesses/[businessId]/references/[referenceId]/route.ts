import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

async function getReference(businessId: bigint, referenceId: bigint) {
  return prisma.businessReference.findFirst({ where: { id: referenceId, businessId } });
}

// PATCH /api/pro/businesses/{businessId}/references/{referenceId}
export const PATCH = withBusinessRoute<{ businessId: string; referenceId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:references:update:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 60 * 60 * 1000 } },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const referenceIdBigInt = parseIdOpt(params.referenceId);
    if (!referenceIdBigInt) return withIdNoStore(badRequest('referenceId invalide.'), requestId);

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

      return jsonb({ item: updated }, requestId);
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('Unique constraint')
          ? 'Un élément avec ce nom existe déjà.'
          : 'Mise à jour impossible.';
      return withIdNoStore(badRequest(message), requestId);
    }
  }
);

// DELETE /api/pro/businesses/{businessId}/references/{referenceId}
export const DELETE = withBusinessRoute<{ businessId: string; referenceId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:references:delete:${ctx.businessId}:${ctx.userId}`, limit: 100, windowMs: 60 * 60 * 1000 } },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const referenceIdBigInt = parseIdOpt(params.referenceId);
    if (!referenceIdBigInt) return withIdNoStore(badRequest('referenceId invalide.'), requestId);

    const existing = await getReference(businessIdBigInt, referenceIdBigInt);
    if (!existing) return withIdNoStore(notFound('Référence introuvable.'), requestId);

    await prisma.businessReference.delete({ where: { id: referenceIdBigInt } });

    return jsonbNoContent(requestId);
  }
);
