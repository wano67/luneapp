import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/interactions/{interactionId}/notes/{noteId}
export const PATCH = withBusinessRoute<{ businessId: string; interactionId: string; noteId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:interaction-notes:update:${ctx.businessId}:${ctx.userId}`, limit: 400, windowMs: 3_600_000 },
  },
  async (ctx, req, params) => {
    const interactionId = parseId(params.interactionId);
    const noteId = parseId(params.noteId);

    const note = await prisma.interactionNote.findFirst({
      where: { id: noteId, interactionId, interaction: { businessId: ctx.businessId } },
    });
    if (!note) return notFound('Note introuvable.');

    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const data: { content?: string; isCompleted?: boolean } = {};
    if (typeof body.content === 'string') {
      const trimmed = body.content.trim();
      if (!trimmed) return badRequest('Contenu requis.');
      if (trimmed.length > 2000) return badRequest('Contenu trop long.');
      data.content = trimmed;
    }
    if (typeof body.isCompleted === 'boolean') {
      data.isCompleted = body.isCompleted;
    }

    const updated = await prisma.interactionNote.update({
      where: { id: noteId },
      data,
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/interactions/{interactionId}/notes/{noteId}
export const DELETE = withBusinessRoute<{ businessId: string; interactionId: string; noteId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:interaction-notes:delete:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 3_600_000 },
  },
  async (ctx, _req, params) => {
    const interactionId = parseId(params.interactionId);
    const noteId = parseId(params.noteId);

    const note = await prisma.interactionNote.findFirst({
      where: { id: noteId, interactionId, interaction: { businessId: ctx.businessId } },
    });
    if (!note) return notFound('Note introuvable.');

    await prisma.interactionNote.delete({ where: { id: noteId } });
    return jsonbNoContent(ctx.requestId);
  }
);
