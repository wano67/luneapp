import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { parseStr } from '@/server/http/parsers';

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

const VALID_METRICS = ['CA_HT', 'RESULTAT_NET', 'REVENU_NET_DIRIGEANT', 'MARGE_BRUTE'] as const;

export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year') || new Date().getFullYear());

    const goals = await prisma.businessGoal.findMany({
      where: { businessId: ctx.businessId, year },
      orderBy: { createdAt: 'asc' },
    });
    return jsonb({ items: goals.map(serialize) }, ctx.requestId);
  },
);

export const POST = withBusinessRoute<{ businessId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `goals:${ctx.businessId}`, limit: 20, windowMs: 60_000 } },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Corps de requete invalide.'), ctx.requestId);
    }

    const name = parseStr(body.name, 200);
    if (!name) {
      return withIdNoStore(badRequest('Le nom est requis.'), ctx.requestId);
    }

    const metric = body.metric as string;
    if (!VALID_METRICS.includes(metric as (typeof VALID_METRICS)[number])) {
      return withIdNoStore(badRequest('Metrique invalide.'), ctx.requestId);
    }

    const targetCents = Math.round(Number(body.targetCents) || 0);
    if (targetCents <= 0) {
      return withIdNoStore(badRequest('L\'objectif doit etre positif.'), ctx.requestId);
    }

    const year = Math.round(Number(body.year) || new Date().getFullYear());
    if (year < 2020 || year > 2100) {
      return withIdNoStore(badRequest('Annee invalide.'), ctx.requestId);
    }

    // Check unique constraint
    const existing = await prisma.businessGoal.findUnique({
      where: { businessId_metric_year: { businessId: ctx.businessId, metric: metric as (typeof VALID_METRICS)[number], year } },
    });
    if (existing) {
      return withIdNoStore(badRequest(`Un objectif ${metric} existe deja pour ${year}.`), ctx.requestId);
    }

    const goal = await prisma.businessGoal.create({
      data: {
        businessId: ctx.businessId,
        name,
        targetCents: BigInt(targetCents),
        metric: metric as (typeof VALID_METRICS)[number],
        year,
      },
    });

    return jsonbCreated({ item: serialize(goal) }, ctx.requestId);
  },
);
