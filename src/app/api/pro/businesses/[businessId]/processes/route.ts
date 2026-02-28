import { prisma } from '@/server/db/client';
import { ProcessStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';

// GET /api/pro/businesses/{businessId}/processes
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const delegateError = ensureDelegate('process', ctx.requestId);
    if (delegateError) return delegateError;

    const { searchParams } = new URL(req.url);
    const includeArchived =
      searchParams.get('archived') === '1' ||
      searchParams.get('archived') === 'true' ||
      searchParams.get('archived') === 'yes';

    const processes = await prisma.process.findMany({
      where: {
        businessId: ctx.businessId,
        ...(includeArchived ? {} : { status: ProcessStatus.ACTIVE }),
      },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        _count: { select: { steps: true } },
      },
    });

    return jsonb({ items: processes }, ctx.requestId);
  }
);

// POST /api/pro/businesses/{businessId}/processes
export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:processes:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const delegateError = ensureDelegate('process', ctx.requestId);
    if (delegateError) return delegateError;

    const body = await readJson(req);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const { name, description, steps } = body as {
      name?: unknown;
      description?: unknown;
      steps?: unknown;
    };

    if (typeof name !== 'string') {
      return badRequest('name requis.');
    }
    const trimmedName = name.trim();
    if (!trimmedName) return badRequest('name ne peut pas être vide.');
    if (trimmedName.length > 200) {
      return badRequest('name trop long (200 max).');
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

    let stepsData: Array<{
      title: string;
      description?: string | null;
      position: number;
      isDone?: boolean;
    }> = [];
    if (steps !== undefined) {
      if (!Array.isArray(steps)) {
        return badRequest('steps doit être un tableau.');
      }
      if (steps.length > 100) {
        return badRequest('steps trop nombreux (100 max).');
      }
      try {
        stepsData = steps.map((raw, idx) => {
          if (!raw || typeof raw !== 'object') {
            throw new Error(`step #${idx + 1} invalide`);
          }
          const step = raw as { title?: unknown; description?: unknown; position?: unknown; isDone?: unknown };
          if (typeof step.title !== 'string') {
            throw new Error(`title requis pour l'étape #${idx + 1}`);
          }
          const title = step.title.trim();
          if (!title) throw new Error(`title ne peut pas être vide (étape #${idx + 1})`);
          if (title.length > 200) throw new Error(`title trop long (200 max) (étape #${idx + 1})`);

          let descriptionStep: string | null | undefined;
          if (step.description !== undefined) {
            if (step.description !== null && typeof step.description !== 'string') {
              throw new Error(`description invalide (étape #${idx + 1})`);
            }
            descriptionStep =
              step.description === null
                ? null
                : typeof step.description === 'string'
                  ? step.description.trim()
                  : undefined;
            if (descriptionStep && descriptionStep.length > 2000) {
              throw new Error(`description trop longue (2000 max) (étape #${idx + 1})`);
            }
          }

          let position = idx + 1;
          if (step.position !== undefined) {
            if (typeof step.position !== 'number' || !Number.isInteger(step.position)) {
              throw new Error(`position doit être un entier (étape #${idx + 1})`);
            }
            if (step.position < 0 || step.position > 10000) {
              throw new Error(`position hors bornes (0-10000) (étape #${idx + 1})`);
            }
            position = step.position;
          }

          let isDone: boolean | undefined;
          if (step.isDone !== undefined) {
            if (typeof step.isDone !== 'boolean') {
              throw new Error(`isDone doit être un booléen (étape #${idx + 1})`);
            }
            isDone = step.isDone;
          }

          return {
            title,
            description: descriptionStep ?? undefined,
            position,
            ...(isDone !== undefined ? { isDone } : {}),
          };
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'steps invalides.';
        return badRequest(message);
      }
    }

    const createdProcess = await prisma.process.create({
      data: {
        businessId: ctx.businessId,
        name: trimmedName,
        description: descriptionValue ?? undefined,
        status: ProcessStatus.ACTIVE,
        ...(stepsData.length ? { steps: { create: stepsData } } : {}),
      },
      include: {
        steps: { orderBy: { position: 'asc' } },
        _count: { select: { steps: true } },
      },
    });

    return jsonbCreated({ item: createdProcess }, ctx.requestId);
  }
);
