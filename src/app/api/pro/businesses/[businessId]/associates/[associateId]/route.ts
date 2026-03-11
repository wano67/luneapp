import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

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

export const GET = withBusinessRoute<{ businessId: string; associateId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const id = parseId(params?.associateId);
    const associate = await prisma.businessAssociate.findFirst({
      where: { id, businessId: ctx.businessId },
    });
    if (!associate) return withIdNoStore(notFound('Associe introuvable.'), ctx.requestId);
    return jsonb({ item: serialize(associate) }, ctx.requestId);
  },
);

export const PATCH = withBusinessRoute<{ businessId: string; associateId: string }>(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `associate:${ctx.businessId}`, limit: 30, windowMs: 60_000 } },
  async (ctx, req, params) => {
    const id = parseId(params?.associateId);
    const existing = await prisma.businessAssociate.findFirst({
      where: { id, businessId: ctx.businessId },
    });
    if (!existing) return withIdNoStore(notFound('Associe introuvable.'), ctx.requestId);

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

    if ('role' in body) {
      if (!VALID_ROLES.includes(body.role as (typeof VALID_ROLES)[number])) {
        return withIdNoStore(badRequest('Role invalide.'), ctx.requestId);
      }
      data.role = body.role;
    }

    if ('isLeader' in body) data.isLeader = body.isLeader === true;

    if ('sharePercent' in body) {
      const sp = Number(body.sharePercent);
      if (!Number.isFinite(sp) || sp < 0 || sp > 100) {
        return withIdNoStore(badRequest('Part sociale invalide (0-100).'), ctx.requestId);
      }
      // Check total excluding current record
      const agg = await prisma.businessAssociate.aggregate({
        where: { businessId: ctx.businessId, id: { not: id } },
        _sum: { sharePercent: true },
      });
      if (Number(agg._sum.sharePercent ?? 0) + sp > 100) {
        return withIdNoStore(badRequest('Parts totales depassent 100%.'), ctx.requestId);
      }
      data.sharePercent = sp;
    }

    if ('grossSalaryYearlyCents' in body) {
      data.grossSalaryYearlyCents = BigInt(Math.max(0, Math.round(Number(body.grossSalaryYearlyCents) || 0)));
    }
    if ('dividendsCents' in body) {
      data.dividendsCents = BigInt(Math.max(0, Math.round(Number(body.dividendsCents) || 0)));
    }
    if ('ccaCents' in body) {
      data.ccaCents = BigInt(Math.max(0, Math.round(Number(body.ccaCents) || 0)));
    }
    if ('nbParts' in body) {
      data.nbParts = Math.max(1, Math.round(Number(body.nbParts) || 1));
    }

    if (Object.keys(data).length === 0) {
      return withIdNoStore(badRequest('Aucune modification.'), ctx.requestId);
    }

    const updated = await prisma.businessAssociate.update({
      where: { id },
      data,
    });

    return jsonb({ item: serialize(updated) }, ctx.requestId);
  },
);

export const DELETE = withBusinessRoute<{ businessId: string; associateId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _req, params) => {
    const id = parseId(params?.associateId);
    const existing = await prisma.businessAssociate.findFirst({
      where: { id, businessId: ctx.businessId },
    });
    if (!existing) return withIdNoStore(notFound('Associe introuvable.'), ctx.requestId);

    await prisma.businessAssociate.delete({ where: { id } });
    return jsonbNoContent(ctx.requestId);
  },
);
