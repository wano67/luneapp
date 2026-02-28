import { BusinessReferenceType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';

function isValidType(value: unknown): value is BusinessReferenceType {
  return Object.values(BusinessReferenceType).includes(value as BusinessReferenceType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

// GET /api/pro/businesses/{businessId}/references
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;
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
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      ...(includeArchived ? {} : { isArchived: false }),
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  return jsonb({ items: references }, requestId);
});

// POST /api/pro/businesses/{businessId}/references
export const POST = withBusinessRoute(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:references:create:${ctx.businessId}:${ctx.userId}`, limit: 120, windowMs: 60 * 60 * 1000 } },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
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

      return jsonbCreated({ item: created }, requestId);
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('Unique constraint')
          ? 'Un élément avec ce nom existe déjà.'
          : 'Création impossible.';
      return withIdNoStore(badRequest(message), requestId);
    }
  }
);
