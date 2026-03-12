import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, forbidden, notFound, readJson } from '@/server/http/apiUtils';
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

// PATCH /api/pro/businesses/{businessId}/tasks/{taskId}/time-entries/{entryId}
export const PATCH = withBusinessRoute<{ businessId: string; taskId: string; entryId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:time-entries:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const taskId = parseId(params.taskId);
    const entryId = parseId(params.entryId);

    const entry = await prisma.timeEntry.findFirst({
      where: { id: entryId, taskId, businessId: ctx.businessId },
    });
    if (!entry) return notFound('Entrée introuvable.');

    const isAdmin = ctx.membership.role === 'ADMIN' || ctx.membership.role === 'OWNER';
    if (!isAdmin && entry.userId !== ctx.userId) {
      return forbidden('Vous ne pouvez modifier que vos propres entrées.');
    }

    const body = await readJson(req);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');
    const b = body as Record<string, unknown>;

    const update: Record<string, unknown> = {};

    // Stop timer
    if (b.action === 'stop') {
      if (entry.stoppedAt) return badRequest('Le chronomètre est déjà arrêté.');
      const now = new Date();
      const diffMs = now.getTime() - entry.startedAt.getTime();
      const durationMin = Math.max(1, Math.round(diffMs / 60_000));
      update.stoppedAt = now;
      update.durationMin = durationMin;
    }

    if (typeof b.description === 'string') {
      const desc = (b.description as string).trim();
      if (desc.length > 500) return badRequest('Description trop longue (500 max).');
      update.description = desc || null;
    }

    if (typeof b.billable === 'boolean') {
      update.billable = b.billable;
    }

    if (typeof b.durationMin === 'number' && Number.isFinite(b.durationMin) && (b.durationMin as number) > 0) {
      update.durationMin = Math.trunc(b.durationMin as number);
      if (!entry.stoppedAt && !update.stoppedAt) {
        update.stoppedAt = new Date();
      }
    }

    if (Object.keys(update).length === 0) {
      return badRequest('Aucune modification.');
    }

    const updated = await prisma.timeEntry.update({
      where: { id: entryId },
      data: update,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return jsonb({ item: serializeEntry(updated) }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/tasks/{taskId}/time-entries/{entryId}
export const DELETE = withBusinessRoute<{ businessId: string; taskId: string; entryId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:time-entries:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const taskId = parseId(params.taskId);
    const entryId = parseId(params.entryId);

    const entry = await prisma.timeEntry.findFirst({
      where: { id: entryId, taskId, businessId: ctx.businessId },
    });
    if (!entry) return notFound('Entrée introuvable.');

    const isAdmin = ctx.membership.role === 'ADMIN' || ctx.membership.role === 'OWNER';
    if (!isAdmin && entry.userId !== ctx.userId) {
      return forbidden('Vous ne pouvez supprimer que vos propres entrées.');
    }

    await prisma.timeEntry.delete({ where: { id: entryId } });

    return jsonbNoContent(ctx.requestId);
  }
);
