import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';

// GET /api/pro/businesses/{businessId}/organization/units
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx) => {
  const units = await prisma.organizationUnit.findMany({
    where: { businessId: ctx.businessId },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });

  return jsonb({ items: units }, ctx.requestId);
});

// POST /api/pro/businesses/{businessId}/organization/units
export const POST = withBusinessRoute({ minRole: 'ADMIN' }, async (ctx, req) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return badRequest('Payload invalide.');
  }

  const nameRaw = (body as { name?: unknown }).name;
  if (typeof nameRaw !== 'string') {
    return badRequest('name requis.');
  }
  const name = nameRaw.trim();
  if (!name) return badRequest('name requis.');
  if (name.length > 80) return badRequest('name trop long (80 max).');

  const orderRaw = (body as { order?: unknown }).order;
  const order =
    typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? Math.trunc(orderRaw) : 0;

  const existing = await prisma.organizationUnit.findFirst({
    where: { businessId: ctx.businessId, name },
    select: { id: true },
  });
  if (existing) {
    return badRequest('Un pôle avec ce nom existe déjà.');
  }

  const created = await prisma.organizationUnit.create({
    data: { businessId: ctx.businessId, name, order },
  });

  return jsonbCreated({ item: created }, ctx.requestId);
});
