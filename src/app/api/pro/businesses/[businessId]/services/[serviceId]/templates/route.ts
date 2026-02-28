import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { TaskPhase } from '@/generated/prisma';

function normalizeStr(value: unknown) {
  return String(value ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

type TemplateInput = {
  title: string;
  phase: TaskPhase | null;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

function validateTemplateBody(body: unknown): TemplateInput | { error: string } {
  if (!isRecord(body)) return { error: 'Payload invalide.' };
  const title = normalizeStr(body.title);
  if (!title || title.length < 1) return { error: 'Titre requis (1-120).' };
  if (title.length > 120) return { error: 'Titre trop long (120 max).' };

  const phaseRaw = typeof body.phase === 'string' ? body.phase : null;
  const phase =
    phaseRaw && Object.values(TaskPhase).includes(phaseRaw as TaskPhase)
      ? (phaseRaw as TaskPhase)
      : null;

  const roleRaw = normalizeStr(body.defaultAssigneeRole);
  const defaultAssigneeRole = roleRaw ? roleRaw : null;
  if (defaultAssigneeRole && defaultAssigneeRole.length > 60) {
    return { error: 'Rôle assigné trop long (60 max).' };
  }

  let defaultDueOffsetDays: number | null = null;
  if (body.defaultDueOffsetDays !== undefined) {
    if (body.defaultDueOffsetDays === null) {
      defaultDueOffsetDays = null;
    } else if (typeof body.defaultDueOffsetDays === 'number' && Number.isFinite(body.defaultDueOffsetDays)) {
      defaultDueOffsetDays = Math.trunc(body.defaultDueOffsetDays);
      if (defaultDueOffsetDays < 0 || defaultDueOffsetDays > 365) {
        return { error: 'Offset jours doit être entre 0 et 365.' };
      }
    } else {
      return { error: 'Offset jours invalide.' };
    }
  }

  return {
    title,
    phase,
    defaultAssigneeRole,
    defaultDueOffsetDays,
  };
}

async function ensureService(businessId: bigint, serviceId: bigint) {
  return prisma.service.findFirst({
    where: { id: serviceId, businessId },
    select: { id: true },
  });
}

// GET /api/pro/businesses/{businessId}/services/{serviceId}/templates
export const GET = withBusinessRoute<{ businessId: string; serviceId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const serviceId = parseId(params.serviceId);

    const service = await ensureService(ctx.businessId, serviceId);
    if (!service) return notFound('Service introuvable.');

    const templates = await prisma.serviceTaskTemplate.findMany({
      where: { serviceId, service: { businessId: ctx.businessId } },
      orderBy: [{ phase: 'asc' }, { createdAt: 'asc' }],
    });

    return jsonb({ items: templates }, ctx.requestId);
  }
);

// POST /api/pro/businesses/{businessId}/services/{serviceId}/templates
export const POST = withBusinessRoute<{ businessId: string; serviceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:services:templates:create:${ctx.businessId}:${ctx.userId}`,
      limit: 200,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const serviceId = parseId(params.serviceId);

    const service = await ensureService(ctx.businessId, serviceId);
    if (!service) return notFound('Service introuvable.');

    const body = await readJson(req);
    const parsed = validateTemplateBody(body);
    if ('error' in parsed) return badRequest(parsed.error);

    const duplicate = await prisma.serviceTaskTemplate.findFirst({
      where: {
        serviceId,
        service: { businessId: ctx.businessId },
        title: parsed.title,
        phase: parsed.phase ?? null,
      },
    });
    if (duplicate) {
      return badRequest('Un template avec ce titre et cette phase existe déjà.');
    }

    const created = await prisma.serviceTaskTemplate.create({
      data: {
        serviceId,
        phase: parsed.phase ?? undefined,
        title: parsed.title,
        defaultAssigneeRole: parsed.defaultAssigneeRole ?? undefined,
        defaultDueOffsetDays: parsed.defaultDueOffsetDays ?? undefined,
      },
    });

    return jsonbCreated({ item: created }, ctx.requestId);
  }
);
