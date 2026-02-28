import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/organization/units/{unitId}
export const PATCH = withBusinessRoute<{ businessId: string; unitId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, req, params) => {
    const unitId = parseId(params.unitId);

    const unit = await prisma.organizationUnit.findFirst({
      where: { id: unitId, businessId: ctx.businessId },
    });
    if (!unit) return notFound('Pôle introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const data: { name?: string; order?: number } = {};
    if ('name' in body) {
      const nameRaw = (body as { name?: unknown }).name;
      if (typeof nameRaw !== 'string') return badRequest('name invalide.');
      const name = nameRaw.trim();
      if (!name) return badRequest('name requis.');
      if (name.length > 80) return badRequest('name trop long (80 max).');
      const existing = await prisma.organizationUnit.findFirst({
        where: { businessId: ctx.businessId, name, NOT: { id: unitId } },
        select: { id: true },
      });
      if (existing) {
        return badRequest('Un pôle avec ce nom existe déjà.');
      }
      data.name = name;
    }

    if ('order' in body) {
      const orderRaw = (body as { order?: unknown }).order;
      if (typeof orderRaw !== 'number' || !Number.isFinite(orderRaw)) {
        return badRequest('order invalide.');
      }
      data.order = Math.trunc(orderRaw);
    }

    if (Object.keys(data).length === 0) {
      return badRequest('Aucune modification.');
    }

    const updated = await prisma.organizationUnit.update({
      where: { id: unitId },
      data,
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/organization/units/{unitId}
export const DELETE = withBusinessRoute<{ businessId: string; unitId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const unitId = parseId(params.unitId);

    const unit = await prisma.organizationUnit.findFirst({
      where: { id: unitId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!unit) return notFound('Pôle introuvable.');

    const assignedCount = await prisma.businessMembership.count({
      where: { organizationUnitId: unitId, businessId: ctx.businessId },
    });
    if (assignedCount > 0) {
      return badRequest('Des membres sont assignés à ce pôle.');
    }

    await prisma.organizationUnit.delete({ where: { id: unitId } });

    return jsonbNoContent(ctx.requestId);
  }
);
