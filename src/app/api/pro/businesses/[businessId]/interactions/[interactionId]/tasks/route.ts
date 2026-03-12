import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

function parseIdOpt(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

// POST /api/pro/businesses/{businessId}/interactions/{interactionId}/tasks
export const POST = withBusinessRoute<{ businessId: string; interactionId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: { key: (ctx) => `pro:interaction-tasks:create:${ctx.businessId}:${ctx.userId}`, limit: 200, windowMs: 3_600_000 },
  },
  async (ctx, req, params) => {
    const interactionId = parseId(params.interactionId);

    const interaction = await prisma.interaction.findFirst({
      where: { id: interactionId, businessId: ctx.businessId },
      select: { id: true, projectId: true, clientId: true },
    });
    if (!interaction) return notFound('Interaction introuvable.');

    const body = await readJson(req);
    if (!isRecord(body)) return badRequest('Payload invalide.');

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return badRequest('Titre requis.');
    if (title.length > 200) return badRequest('Titre trop long (200 max).');

    const dueDateStr = typeof body.dueDate === 'string' ? body.dueDate : null;
    const dueDate = dueDateStr ? new Date(dueDateStr) : null;
    if (dueDate && Number.isNaN(dueDate.getTime())) return badRequest('Date invalide.');

    const assigneeUserId = parseIdOpt(typeof body.assigneeUserId === 'string' ? body.assigneeUserId : undefined);

    const task = await prisma.task.create({
      data: {
        businessId: ctx.businessId,
        projectId: interaction.projectId ?? undefined,
        interactionId,
        title,
        status: 'TODO',
        dueDate: dueDate ?? undefined,
        assigneeUserId: assigneeUserId ?? ctx.userId,
      },
    });

    return jsonbCreated({ item: task }, ctx.requestId);
  }
);
