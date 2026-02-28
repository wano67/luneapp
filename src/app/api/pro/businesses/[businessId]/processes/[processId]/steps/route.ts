import { prisma } from '@/server/db/client';
import { ProcessStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { ensureDelegates } from '@/server/http/delegates';
import { parseId } from '@/server/http/parsers';

// POST /api/pro/businesses/{businessId}/processes/{processId}/steps
export const POST = withBusinessRoute<{ businessId: string; processId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:processes:steps:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const delegateError = ensureDelegates(['process', 'processStep'], ctx.requestId);
    if (delegateError) return delegateError;

    const processId = parseId(params.processId);

    const process = await prisma.process.findFirst({
      where: { id: processId, businessId: ctx.businessId },
      select: { id: true, status: true },
    });
    if (!process) return notFound('Process introuvable.');
    if (process.status === ProcessStatus.ARCHIVED) {
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

    if (typeof title !== 'string') {
      return badRequest('title requis.');
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return badRequest('title ne peut pas être vide.');
    }
    if (trimmedTitle.length > 200) {
      return badRequest('title trop long (200 max).');
    }

    let descriptionValue: string | null | undefined;
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return badRequest('description invalide.');
      }
      descriptionValue =
        description === null
          ? null
          : typeof description === 'string'
            ? description.trim()
            : undefined;
      if (descriptionValue && descriptionValue.length > 2000) {
        return badRequest('description trop longue (2000 max).');
      }
    }

    let positionValue: number | null = null;
    if (position !== undefined) {
      if (typeof position !== 'number' || !Number.isInteger(position)) {
        return badRequest('position doit être un entier.');
      }
      if (position < 0 || position > 10000) {
        return badRequest('position hors bornes (0-10000).');
      }
      positionValue = position;
    }

    if (isDone !== undefined && typeof isDone !== 'boolean') {
      return badRequest('isDone doit être un booléen.');
    }

    let nextPosition = positionValue;
    if (nextPosition === null) {
      const last = await prisma.processStep.findFirst({
        where: { processId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      nextPosition = (last?.position ?? 0) + 1;
    }

    const step = await prisma.processStep.create({
      data: {
        processId,
        title: trimmedTitle,
        description: descriptionValue ?? undefined,
        position: nextPosition,
        ...(typeof isDone === 'boolean' ? { isDone } : {}),
      },
    });

    return jsonbCreated({ item: step }, ctx.requestId);
  }
);
