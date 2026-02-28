import { prisma } from '@/server/db/client';
import { ProcessStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';
import { parseId } from '@/server/http/parsers';

async function fetchProcessWithSteps(processId: bigint, businessId: bigint) {
  return prisma.process.findFirst({
    where: { id: processId, businessId },
    include: {
      steps: { orderBy: { position: 'asc' } },
    },
  });
}

// GET /api/pro/businesses/{businessId}/processes/{processId}
export const GET = withBusinessRoute<{ businessId: string; processId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const delegateError = ensureDelegate('process', ctx.requestId);
    if (delegateError) return delegateError;

    const processId = parseId(params.processId);

    const process = await fetchProcessWithSteps(processId, ctx.businessId);
    if (!process) return notFound('Process introuvable.');

    return jsonb({ item: process }, ctx.requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/processes/{processId}
export const PATCH = withBusinessRoute<{ businessId: string; processId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:processes:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const delegateError = ensureDelegate('process', ctx.requestId);
    if (delegateError) return delegateError;

    const processId = parseId(params.processId);

    const existing = await fetchProcessWithSteps(processId, ctx.businessId);
    if (!existing) return notFound('Process introuvable.');

    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const { name, description, status, archived } = body as {
      name?: unknown;
      description?: unknown;
      status?: unknown;
      archived?: unknown;
    };

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== 'string') {
        return badRequest('name invalide.');
      }
      const trimmed = name.trim();
      if (!trimmed) return badRequest('name ne peut pas être vide.');
      if (trimmed.length > 200) {
        return badRequest('name trop long (200 max).');
      }
      data.name = trimmed;
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

    let statusFromFlag: ProcessStatus | null = null;
    if (archived !== undefined) {
      if (typeof archived !== 'boolean') {
        return badRequest('archived doit être un booléen.');
      }
      statusFromFlag = archived ? ProcessStatus.ARCHIVED : ProcessStatus.ACTIVE;
    }

    let statusValue: ProcessStatus | null = null;
    if (status !== undefined) {
      if (status === ProcessStatus.ACTIVE || status === 'ACTIVE') {
        statusValue = ProcessStatus.ACTIVE;
      } else if (status === ProcessStatus.ARCHIVED || status === 'ARCHIVED') {
        statusValue = ProcessStatus.ARCHIVED;
      } else {
        return badRequest('status invalide.');
      }
      if (statusFromFlag && statusValue && statusFromFlag !== statusValue) {
        return badRequest('archived et status incohérents.');
      }
      data.status = statusValue;
    } else if (statusFromFlag) {
      data.status = statusFromFlag;
    }

    if (Object.keys(data).length === 0) {
      return badRequest('Aucune modification.');
    }

    const updated = await prisma.process.update({
      where: { id: processId },
      data,
      include: {
        steps: { orderBy: { position: 'asc' } },
      },
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/processes/{processId}
export const DELETE = withBusinessRoute<{ businessId: string; processId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:processes:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const delegateError = ensureDelegate('process', ctx.requestId);
    if (delegateError) return delegateError;

    const processId = parseId(params.processId);

    const process = await prisma.process.findFirst({
      where: { id: processId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!process) return notFound('Process introuvable.');

    await prisma.process.delete({ where: { id: processId } });

    return jsonbNoContent(ctx.requestId);
  }
);
