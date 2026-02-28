import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { InteractionType } from '@/generated/prisma';

function parseIdOpt(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

// GET /api/pro/businesses/{businessId}/interactions
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const { searchParams } = new URL(req.url);
    const clientId = parseIdOpt(searchParams.get('clientId'));
    const projectId = parseIdOpt(searchParams.get('projectId'));
    const typeParam = searchParams.get('type')?.trim().toUpperCase() ?? null;
    const allowedTypes: InteractionType[] = ['CALL', 'MEETING', 'EMAIL', 'NOTE', 'MESSAGE'];
    const typeFilter: InteractionType | null =
      typeParam && allowedTypes.includes(typeParam as InteractionType) ? (typeParam as InteractionType) : null;

    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');
    const limitParam = searchParams.get('limit');

    let limit = 50;
    if (limitParam) {
      const parsed = Number(limitParam);
      if (!Number.isFinite(parsed) || parsed < 1) return badRequest('limit invalide.');
      limit = Math.min(100, Math.max(1, Math.trunc(parsed)));
    }

    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    if (fromStr) {
      const d = new Date(fromStr);
      if (Number.isNaN(d.getTime())) return badRequest('from invalide.');
      fromDate = d;
    }
    if (toStr) {
      const d = new Date(toStr);
      if (Number.isNaN(d.getTime())) return badRequest('to invalide.');
      toDate = d;
    }

    const range: { gte?: Date; lte?: Date } = {};
    if (fromDate) range.gte = fromDate;
    if (toDate) range.lte = toDate;

    const interactions = await prisma.interaction.findMany({
      where: {
        businessId: ctx.businessId,
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(fromDate || toDate ? { happenedAt: range } : {}),
      },
      orderBy: [{ happenedAt: 'desc' }],
      take: limit,
    });

    return jsonb({ items: interactions }, ctx.requestId);
  }
);

// POST /api/pro/businesses/{businessId}/interactions
export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:interactions:create:${ctx.businessId}:${ctx.userId}`, limit: 300, windowMs: 60 * 60 * 1000 },
  },
  async (ctx, req) => {
    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const type = typeof body.type === 'string' ? body.type : null;
    const content = typeof body.content === 'string' ? body.content.trim() : '';
    const happenedAtStr = typeof body.happenedAt === 'string' ? body.happenedAt : null;
    const nextActionStr = typeof body.nextActionDate === 'string' ? body.nextActionDate : null;
    const clientId = parseIdOpt(typeof body.clientId === 'string' ? body.clientId : undefined);
    const projectId = parseIdOpt(typeof body.projectId === 'string' ? body.projectId : undefined);

    const allowedTypes = ['CALL', 'MEETING', 'EMAIL', 'NOTE', 'MESSAGE'];
    if (!type || !allowedTypes.includes(type)) return badRequest('Type invalide.');
    if (!content) return badRequest('Contenu requis.');
    const happenedAt = happenedAtStr ? new Date(happenedAtStr) : new Date();
    if (Number.isNaN(happenedAt.getTime())) return badRequest('Date invalide.');
    const nextActionDate = nextActionStr ? new Date(nextActionStr) : null;
    if (nextActionDate && Number.isNaN(nextActionDate.getTime())) return badRequest('Next action invalide.');

    if (!clientId && !projectId) {
      return badRequest('clientId ou projectId requis.');
    }

    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId, businessId: ctx.businessId } });
      if (!client) return notFound('Client introuvable.');
    }
    if (projectId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, businessId: ctx.businessId } });
      if (!project) return notFound('Projet introuvable.');
    }

    const created = await prisma.interaction.create({
      data: {
        businessId: ctx.businessId,
        clientId: clientId ?? undefined,
        projectId: projectId ?? undefined,
        type: type as 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE',
        content,
        happenedAt,
        nextActionDate: nextActionDate ?? undefined,
        createdByUserId: ctx.userId,
      },
    });

    return jsonbCreated({ item: created }, ctx.requestId);
  }
);
