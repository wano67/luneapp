import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/tasks/{taskId}/checklist/{itemId}
export const PATCH = withBusinessRoute<{ businessId: string; taskId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:tasks:checklist:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const taskId = parseId(params.taskId);
    const itemId = parseId(params.itemId);

    const task = await prisma.task.findFirst({
      where: { id: taskId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!task) return notFound('Tâche introuvable.');

    const existing = await prisma.taskChecklistItem.findFirst({
      where: { id: itemId, taskId },
      include: { completedBy: { select: { id: true, name: true, email: true } } },
    });
    if (!existing) return notFound('Item introuvable.');

    const body = await readJson(req);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const data: Record<string, unknown> = {};

    if ('title' in body) {
      const raw = (body as { title?: unknown }).title;
      if (raw === null || raw === undefined || raw === '') {
        data.title = null;
      } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return badRequest('title ne peut pas être vide.');
        if (trimmed.length > 200) return badRequest('title trop long (200 max).');
        data.title = trimmed;
      } else {
        return badRequest('title invalide.');
      }
    }

    if ('position' in body) {
      const raw = (body as { position?: unknown }).position;
      if (raw === null || raw === undefined) {
        // ignore
      } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        data.position = Math.max(0, Math.trunc(raw));
      } else {
        return badRequest('position invalide.');
      }
    }

    if ('isCompleted' in body) {
      const raw = (body as { isCompleted?: unknown }).isCompleted;
      if (typeof raw !== 'boolean') return badRequest('isCompleted invalide.');
      data.isCompleted = raw;
      if (raw) {
        data.completedAt = new Date();
        data.completedByUserId = ctx.userId;
      } else {
        data.completedAt = null;
        data.completedByUserId = null;
      }
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.taskChecklistItem.update({
      where: { id: itemId },
      data,
      include: { completedBy: { select: { id: true, name: true, email: true } } },
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/tasks/{taskId}/checklist/{itemId}
export const DELETE = withBusinessRoute<{ businessId: string; taskId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:tasks:checklist:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const taskId = parseId(params.taskId);
    const itemId = parseId(params.itemId);

    const task = await prisma.task.findFirst({
      where: { id: taskId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!task) return notFound('Tâche introuvable.');

    const existing = await prisma.taskChecklistItem.findFirst({
      where: { id: itemId, taskId },
      select: { id: true },
    });
    if (!existing) return notFound('Item introuvable.');

    await prisma.taskChecklistItem.delete({ where: { id: itemId } });

    return jsonbNoContent(ctx.requestId);
  }
);
