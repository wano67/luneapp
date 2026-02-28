import { prisma } from '@/server/db/client';
import { ProcessStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { ensureDelegates } from '@/server/http/delegates';
import { parseId } from '@/server/http/parsers';

// PATCH /api/pro/businesses/{businessId}/processes/{processId}/steps/{stepId}
export const PATCH = withBusinessRoute<{ businessId: string; processId: string; stepId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:processes:steps:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const delegateError = ensureDelegates(['process', 'processStep'], ctx.requestId);
    if (delegateError) return delegateError;

    const processId = parseId(params.processId);
    const stepId = parseId(params.stepId);

    const existing = await prisma.processStep.findFirst({
      where: {
        id: stepId,
        processId,
        process: { businessId: ctx.businessId },
      },
      include: {
        process: { select: { status: true } },
      },
    });
    if (!existing) return notFound('Étape introuvable.');
    if (existing.process.status === ProcessStatus.ARCHIVED) {
      return badRequest('Process archivé : déverrouillez-le avant modification.');
    }

    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const { title, description, position, isDone } = body as {
      title?: unknown;
      description?: unknown;
      position?: unknown;
      isDone?: unknown;
    };

    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== 'string') {
        return badRequest('title invalide.');
      }
      const trimmed = title.trim();
      if (!trimmed) return badRequest('title ne peut pas être vide.');
      if (trimmed.length > 200) {
        return badRequest('title trop long (200 max).');
      }
      data.title = trimmed;
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return badRequest('description invalide.');
      }
      const value =
        description === null ? null : typeof description === 'string' ? description.trim() : undefined;
      if (value && value.length > 2000) {
        return badRequest('description trop longue (2000 max).');
      }
      data.description = value ?? null;
    }

    if (position !== undefined) {
      if (typeof position !== 'number' || !Number.isInteger(position)) {
        return badRequest('position doit être un entier.');
      }
      if (position < 0 || position > 10000) {
        return badRequest('position hors bornes (0-10000).');
      }
      data.position = position;
    }

    if (isDone !== undefined) {
      if (typeof isDone !== 'boolean') {
        return badRequest('isDone doit être un booléen.');
      }
      data.isDone = isDone;
    }

    if (Object.keys(data).length === 0) {
      return badRequest('Aucune modification.');
    }

    const updated = await prisma.processStep.update({
      where: { id: stepId },
      data,
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/processes/{processId}/steps/{stepId}
export const DELETE = withBusinessRoute<{ businessId: string; processId: string; stepId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:processes:steps:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const delegateError = ensureDelegates(['process', 'processStep'], ctx.requestId);
    if (delegateError) return delegateError;

    const processId = parseId(params.processId);
    const stepId = parseId(params.stepId);

    const existing = await prisma.processStep.findFirst({
      where: {
        id: stepId,
        processId,
        process: { businessId: ctx.businessId },
      },
      include: {
        process: { select: { status: true } },
      },
    });
    if (!existing) return notFound('Étape introuvable.');
    if (existing.process.status === ProcessStatus.ARCHIVED) {
      return badRequest('Process archivé : déverrouillez-le avant modification.');
    }

    await prisma.processStep.delete({ where: { id: stepId } });

    return jsonbNoContent(ctx.requestId);
  }
);
