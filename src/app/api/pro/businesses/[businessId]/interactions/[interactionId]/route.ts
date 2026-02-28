import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/interactions/{interactionId}
export const PATCH = withBusinessRoute<{ businessId: string; interactionId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:interactions:update:${ctx.businessId}:${ctx.userId}`, limit: 400, windowMs: 60 * 60 * 1000 },
  },
  async (ctx, _req, params) => {
    const interactionId = parseId(params.interactionId);

    const existing = await prisma.interaction.findFirst({
      where: { id: interactionId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Interaction introuvable.');

    const body = await readJson(_req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const type = typeof body.type === 'string' ? body.type : null;
    const content = typeof body.content === 'string' ? body.content.trim() : undefined;
    const happenedAtStr = typeof body.happenedAt === 'string' ? body.happenedAt : null;
    const nextActionStr = typeof body.nextActionDate === 'string' ? body.nextActionDate : null;

    if (content !== undefined && !content) return badRequest('Contenu requis.');
    const data: {
      type?: 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE';
      content?: string;
      happenedAt?: Date;
      nextActionDate?: Date | null;
    } = {};
    if (type) {
      const allowed = ['CALL', 'MEETING', 'EMAIL', 'NOTE', 'MESSAGE'];
      if (!allowed.includes(type)) return badRequest('Type invalide.');
      data.type = type as 'CALL' | 'MEETING' | 'EMAIL' | 'NOTE' | 'MESSAGE';
    }
    if (content !== undefined) data.content = content;
    if (happenedAtStr) {
      const d = new Date(happenedAtStr);
      if (Number.isNaN(d.getTime())) return badRequest('Date invalide.');
      data.happenedAt = d;
    }
    if (nextActionStr) {
      const d = new Date(nextActionStr);
      if (Number.isNaN(d.getTime())) return badRequest('Next action invalide.');
      data.nextActionDate = d;
    } else if (nextActionStr === null) {
      data.nextActionDate = null;
    }

    const updated = await prisma.interaction.update({
      where: { id: interactionId },
      data,
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/interactions/{interactionId}
export const DELETE = withBusinessRoute<{ businessId: string; interactionId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:interactions:delete:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 60 * 60 * 1000 },
  },
  async (ctx, _req, params) => {
    const interactionId = parseId(params.interactionId);

    const existing = await prisma.interaction.findFirst({
      where: { id: interactionId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Interaction introuvable.');

    await prisma.interaction.delete({ where: { id: interactionId } });
    return jsonbNoContent(ctx.requestId);
  }
);
