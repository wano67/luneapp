import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { TaskPhase } from '@/generated/prisma';

function normalizeStr(value: unknown) {
  return String(value ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

type TemplateUpdate = {
  title?: string;
  phase?: TaskPhase | null;
  defaultAssigneeRole?: string | null;
  defaultDueOffsetDays?: number | null;
};

function validateUpdate(body: unknown): TemplateUpdate | { error: string } {
  if (!isRecord(body)) return { error: 'Payload invalide.' };
  const updates: TemplateUpdate = {};

  if ('title' in body) {
    const title = normalizeStr(body.title);
    if (!title || title.length < 1) return { error: 'Titre requis (1-120).' };
    if (title.length > 120) return { error: 'Titre trop long (120 max).' };
    updates.title = title;
  }

  if ('phase' in body) {
    const raw = typeof body.phase === 'string' ? body.phase : null;
    updates.phase =
      raw && Object.values(TaskPhase).includes(raw as TaskPhase) ? (raw as TaskPhase) : null;
  }

  if ('defaultAssigneeRole' in body) {
    const role = normalizeStr(body.defaultAssigneeRole);
    if (role && role.length > 60) return { error: 'Rôle assigné trop long (60 max).' };
    updates.defaultAssigneeRole = role ? role : null;
  }

  if ('defaultDueOffsetDays' in body) {
    if (body.defaultDueOffsetDays === null) {
      updates.defaultDueOffsetDays = null;
    } else if (typeof body.defaultDueOffsetDays === 'number' && Number.isFinite(body.defaultDueOffsetDays)) {
      const value = Math.trunc(body.defaultDueOffsetDays);
      if (value < 0 || value > 365) return { error: 'Offset jours doit être entre 0 et 365.' };
      updates.defaultDueOffsetDays = value;
    } else {
      return { error: 'Offset jours invalide.' };
    }
  }

  if (
    !('title' in updates) &&
    !('phase' in updates) &&
    !('defaultAssigneeRole' in updates) &&
    !('defaultDueOffsetDays' in updates)
  ) {
    return { error: 'Aucune mise à jour fournie.' };
  }

  return updates;
}

async function getTemplate(businessId: bigint, serviceId: bigint, templateId: bigint) {
  return prisma.serviceTaskTemplate.findFirst({
    where: { id: templateId, serviceId, service: { businessId } },
  });
}

// PATCH /api/pro/businesses/{businessId}/services/{serviceId}/templates/{templateId}
export const PATCH = withBusinessRoute<{ businessId: string; serviceId: string; templateId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:services:templates:update:${ctx.businessId}:${ctx.userId}`,
      limit: 300,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const serviceId = parseId(params.serviceId);
    const templateId = parseId(params.templateId);

    const existing = await getTemplate(ctx.businessId, serviceId, templateId);
    if (!existing) return notFound('Template introuvable.');

    const body = await readJson(req);
    const updates = validateUpdate(body);
    if ('error' in updates) return badRequest(updates.error);

    const nextTitle = 'title' in updates ? updates.title ?? existing.title : existing.title;
    const nextPhase = 'phase' in updates ? updates.phase : existing.phase;

    if ('title' in updates || 'phase' in updates) {
      const duplicate = await prisma.serviceTaskTemplate.findFirst({
        where: {
          serviceId,
          service: { businessId: ctx.businessId },
          title: nextTitle,
          phase: nextPhase,
          NOT: { id: templateId },
        },
      });
      if (duplicate) {
        return badRequest('Un template avec ce titre et cette phase existe déjà.');
      }
    }

    const updated = await prisma.serviceTaskTemplate.update({
      where: { id: templateId },
      data: {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...('phase' in updates ? { phase: updates.phase ?? null } : {}),
        ...('defaultAssigneeRole' in updates
          ? { defaultAssigneeRole: updates.defaultAssigneeRole ?? null }
          : {}),
        ...('defaultDueOffsetDays' in updates
          ? { defaultDueOffsetDays: updates.defaultDueOffsetDays ?? null }
          : {}),
      },
    });

    return jsonb({ item: updated }, ctx.requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/services/{serviceId}/templates/{templateId}
export const DELETE = withBusinessRoute<{ businessId: string; serviceId: string; templateId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:services:templates:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 200,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const serviceId = parseId(params.serviceId);
    const templateId = parseId(params.templateId);

    const existing = await getTemplate(ctx.businessId, serviceId, templateId);
    if (!existing) return notFound('Template introuvable.');

    await prisma.serviceTaskTemplate.delete({ where: { id: templateId } });

    return jsonbNoContent(ctx.requestId);
  }
);
