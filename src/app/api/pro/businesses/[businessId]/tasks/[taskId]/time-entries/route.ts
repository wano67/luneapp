import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

function serializeEntry(e: {
  id: bigint;
  taskId: bigint;
  userId: bigint;
  startedAt: Date;
  stoppedAt: Date | null;
  durationMin: number | null;
  description: string | null;
  billable: boolean;
  createdAt: Date;
  user: { id: bigint; name: string | null; email: string };
}) {
  return {
    id: e.id.toString(),
    taskId: e.taskId.toString(),
    userId: e.userId.toString(),
    userName: e.user.name,
    userEmail: e.user.email,
    startedAt: e.startedAt.toISOString(),
    stoppedAt: e.stoppedAt?.toISOString() ?? null,
    durationMin: e.durationMin,
    description: e.description,
    billable: e.billable,
    createdAt: e.createdAt.toISOString(),
  };
}

// GET /api/pro/businesses/{businessId}/tasks/{taskId}/time-entries
export const GET = withBusinessRoute<{ businessId: string; taskId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const taskId = parseId(params.taskId);

    const task = await prisma.task.findFirst({
      where: { id: taskId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!task) return notFound('Tâche introuvable.');

    const entries = await prisma.timeEntry.findMany({
      where: { taskId, businessId: ctx.businessId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { startedAt: 'desc' },
    });

    const totalMin = entries.reduce((sum, e) => sum + (e.durationMin ?? 0), 0);

    return jsonb({
      items: entries.map(serializeEntry),
      totalMin,
    }, ctx.requestId);
  }
);

// POST /api/pro/businesses/{businessId}/tasks/{taskId}/time-entries
export const POST = withBusinessRoute<{ businessId: string; taskId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:time-entries:create:${ctx.businessId}:${ctx.userId}`,
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

    const b = body as Record<string, unknown>;

    // Check if user already has a running timer on this task
    const running = await prisma.timeEntry.findFirst({
      where: { taskId, userId: ctx.userId, stoppedAt: null },
    });
    if (running && !b.durationMin) {
      return badRequest('Un chronomètre est déjà en cours sur cette tâche.');
    }

    const data: {
      businessId: bigint;
      taskId: bigint;
      userId: bigint;
      startedAt?: Date;
      stoppedAt?: Date;
      durationMin?: number;
      description?: string;
      billable?: boolean;
    } = {
      businessId: ctx.businessId,
      taskId,
      userId: ctx.userId,
    };

    // Manual entry (with duration) vs timer start
    if (typeof b.durationMin === 'number' && Number.isFinite(b.durationMin) && b.durationMin > 0) {
      const dur = Math.trunc(b.durationMin as number);
      const now = new Date();
      data.startedAt = new Date(now.getTime() - dur * 60 * 1000);
      data.stoppedAt = now;
      data.durationMin = dur;
    }

    if (typeof b.description === 'string') {
      const desc = (b.description as string).trim();
      if (desc.length > 500) return badRequest('Description trop longue (500 max).');
      if (desc) data.description = desc;
    }

    if (typeof b.billable === 'boolean') {
      data.billable = b.billable;
    }

    const created = await prisma.timeEntry.create({
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return jsonbCreated({ item: serializeEntry(created) }, ctx.requestId);
  }
);
