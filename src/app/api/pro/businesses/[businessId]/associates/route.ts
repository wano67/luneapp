import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { parseStr } from '@/server/http/parsers';

function serialize(a: {
  id: bigint;
  name: string;
  role: string;
  isLeader: boolean;
  sharePercent: unknown;
  grossSalaryYearlyCents: bigint;
  dividendsCents: bigint;
  ccaCents: bigint;
  nbParts: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id.toString(),
    name: a.name,
    role: a.role,
    isLeader: a.isLeader,
    sharePercent: Number(a.sharePercent),
    grossSalaryYearlyCents: Number(a.grossSalaryYearlyCents),
    dividendsCents: Number(a.dividendsCents),
    ccaCents: Number(a.ccaCents),
    nbParts: a.nbParts,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

const VALID_ROLES = ['PRESIDENT', 'DIRECTEUR_GENERAL', 'GERANT_MAJORITAIRE', 'GERANT_MINORITAIRE', 'ASSOCIE'] as const;

export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const associates = await prisma.businessAssociate.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: 'asc' },
    });
    return jsonb({ items: associates.map(serialize) }, ctx.requestId);
  },
);

export const POST = withBusinessRoute<{ businessId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `associates:${ctx.businessId}`, limit: 20, windowMs: 60_000 } },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Corps de requete invalide.'), ctx.requestId);
    }

    const name = parseStr(body.name, 200);
    if (!name) {
      return withIdNoStore(badRequest('Le nom est requis.'), ctx.requestId);
    }

    const role = body.role as string;
    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
      return withIdNoStore(badRequest('Role invalide.'), ctx.requestId);
    }

    const sharePercent = Number(body.sharePercent);
    if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) {
      return withIdNoStore(badRequest('Part sociale invalide (0-100).'), ctx.requestId);
    }

    // Check total shares don't exceed 100
    const existing = await prisma.businessAssociate.aggregate({
      where: { businessId: ctx.businessId },
      _sum: { sharePercent: true },
    });
    const currentTotal = Number(existing._sum.sharePercent ?? 0);
    if (currentTotal + sharePercent > 100) {
      return withIdNoStore(badRequest(`Parts totales depassent 100% (actuel: ${currentTotal}%).`), ctx.requestId);
    }

    const associate = await prisma.businessAssociate.create({
      data: {
        businessId: ctx.businessId,
        name,
        role: role as (typeof VALID_ROLES)[number],
        isLeader: body.isLeader === true,
        sharePercent,
        grossSalaryYearlyCents: BigInt(Math.max(0, Math.round(Number(body.grossSalaryYearlyCents) || 0))),
        dividendsCents: BigInt(Math.max(0, Math.round(Number(body.dividendsCents) || 0))),
        ccaCents: BigInt(Math.max(0, Math.round(Number(body.ccaCents) || 0))),
        nbParts: Math.max(1, Math.round(Number(body.nbParts) || 1)),
      },
    });

    return jsonbCreated({ item: serialize(associate) }, ctx.requestId);
  },
);
