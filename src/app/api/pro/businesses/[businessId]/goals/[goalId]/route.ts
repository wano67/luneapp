import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

function serialize(g: {
  id: bigint;
  name: string;
  targetCents: bigint;
  metric: string;
  year: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: g.id.toString(),
    name: g.name,
    targetCents: Number(g.targetCents),
    metric: g.metric,
    year: g.year,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

export const PATCH = withBusinessRoute<{ businessId: string; goalId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `goal:${ctx.businessId}`, limit: 30, windowMs: 60_000 } },
  async (ctx, req, params) => {
    const id = parseId(params?.goalId);
    const existing = await prisma.businessGoal.findFirst({
      where: { id, businessId: ctx.businessId },
    });
    if (!existing) return withIdNoStore(notFound('Objectif introuvable.'), ctx.requestId);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Corps de requete invalide.'), ctx.requestId);
    }

    const data: Record<string, unknown> = {};

    if ('name' in body && typeof body.name === 'string') {
      const name = body.name.trim();
      if (!name) return withIdNoStore(badRequest('Le nom est requis.'), ctx.requestId);
      data.name = name;
    }

    if ('targetCents' in body) {
      const target = Math.round(Number(body.targetCents) || 0);
      if (target <= 0) return withIdNoStore(badRequest('L\'objectif doit etre positif.'), ctx.requestId);
      data.targetCents = BigInt(target);
    }

    if (Object.keys(data).length === 0) {
      return withIdNoStore(badRequest('Aucune modification.'), ctx.requestId);
    }

    const updated = await prisma.businessGoal.update({
      where: { id },
      data,
    });

    return jsonb({ item: serialize(updated) }, ctx.requestId);
  },
);

export const DELETE = withBusinessRoute<{ businessId: string; goalId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const id = parseId(params?.goalId);
    const existing = await prisma.businessGoal.findFirst({
      where: { id, businessId: ctx.businessId },
    });
    if (!existing) return withIdNoStore(notFound('Objectif introuvable.'), ctx.requestId);

    await prisma.businessGoal.delete({ where: { id } });
    return jsonbNoContent(ctx.requestId);
  },
);
