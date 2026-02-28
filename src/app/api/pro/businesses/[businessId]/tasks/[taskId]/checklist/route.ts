import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/tasks/{taskId}/checklist
export const GET = withBusinessRoute<{ businessId: string; taskId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const taskId = parseId(params.taskId);

    const task = await prisma.task.findFirst({
      where: { id: taskId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!task) return notFound('Tâche introuvable.');

    const items = await prisma.taskChecklistItem.findMany({
      where: { taskId },
      include: { completedBy: { select: { id: true, name: true, email: true } } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    return jsonb({ items }, ctx.requestId);
  }
);

// POST /api/pro/businesses/{businessId}/tasks/{taskId}/checklist
export const POST = withBusinessRoute<{ businessId: string; taskId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:tasks:checklist:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const taskId = parseId(params.taskId);

    const task = await prisma.task.findFirst({
      where: { id: taskId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!task) return notFound('Tâche introuvable.');

    const body = await readJson(req);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const titleRaw = (body as { title?: unknown }).title;
    if (typeof titleRaw !== 'string') return badRequest('title requis.');
    const title = titleRaw.trim();
    if (!title) return badRequest('title ne peut pas être vide.');
    if (title.length > 200) return badRequest('title trop long (200 max).');

    let position: number | undefined;
    if ('position' in body && (body as { position?: unknown }).position !== undefined) {
      const raw = (body as { position?: unknown }).position;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return badRequest('position invalide.');
      position = Math.max(0, Math.trunc(raw));
    }

    if (position === undefined) {
      const last = await prisma.taskChecklistItem.findFirst({
        where: { taskId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      position = last ? last.position + 1 : 0;
    }

    const created = await prisma.taskChecklistItem.create({
      data: { taskId, title, position },
      include: { completedBy: { select: { id: true, name: true, email: true } } },
    });

    return jsonbCreated({ item: created }, ctx.requestId);
  }
);
