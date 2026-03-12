import { prisma } from '@/server/db/client';
import { AutomationTrigger, AutomationAction } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';

const VALID_TRIGGERS = Object.values(AutomationTrigger);
const VALID_ACTIONS = Object.values(AutomationAction);

function serialize(a: { id: bigint; businessId: bigint; projectId: bigint | null; name: string; trigger: string; action: string; config: unknown; enabled: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: a.id.toString(),
    businessId: a.businessId.toString(),
    projectId: a.projectId?.toString() ?? null,
    name: a.name,
    trigger: a.trigger,
    action: a.action,
    config: a.config,
    enabled: a.enabled,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

// PATCH /api/pro/businesses/{businessId}/automations/{automationId}
export const PATCH = withBusinessRoute<{ businessId: string; automationId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:automations:update:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const automationId = parseIdOpt(params?.automationId);
    if (!automationId) return badRequest('automationId invalide.');

    const existing = await prisma.automation.findFirst({
      where: { id: automationId, businessId: ctx.businessId },
    });
    if (!existing) return notFound('Automation introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const data: Record<string, unknown> = {};
    const b = body as Record<string, unknown>;

    if ('name' in b) {
      if (typeof b.name !== 'string' || !b.name.trim()) return badRequest('name requis.');
      if (b.name.trim().length > 200) return badRequest('name trop long.');
      data.name = b.name.trim();
    }

    if ('trigger' in b) {
      if (!VALID_TRIGGERS.includes(b.trigger as AutomationTrigger)) return badRequest('trigger invalide.');
      data.trigger = b.trigger;
    }

    if ('action' in b) {
      if (!VALID_ACTIONS.includes(b.action as AutomationAction)) return badRequest('action invalide.');
      data.action = b.action;
    }

    if ('config' in b) {
      if (b.config && typeof b.config === 'object') {
        data.config = b.config;
      }
    }

    if ('enabled' in b) {
      if (typeof b.enabled !== 'boolean') return badRequest('enabled invalide.');
      data.enabled = b.enabled;
    }

    if ('projectId' in b) {
      if (b.projectId === null || b.projectId === '') {
        data.projectId = null;
      } else {
        const pId = parseIdOpt(b.projectId as string);
        if (!pId) return badRequest('projectId invalide.');
        const project = await prisma.project.findFirst({
          where: { id: pId, businessId: ctx.businessId },
          select: { id: true },
        });
        if (!project) return badRequest('Projet introuvable.');
        data.projectId = pId;
      }
    }

    if (Object.keys(data).length === 0) return badRequest('Aucune modification.');

    const updated = await prisma.automation.update({
      where: { id: automationId },
      data,
    });

    return jsonb({ item: serialize(updated) }, ctx.requestId);
  },
);

// DELETE /api/pro/businesses/{businessId}/automations/{automationId}
export const DELETE = withBusinessRoute<{ businessId: string; automationId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:automations:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const automationId = parseIdOpt(params?.automationId);
    if (!automationId) return badRequest('automationId invalide.');

    const existing = await prisma.automation.findFirst({
      where: { id: automationId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!existing) return notFound('Automation introuvable.');

    await prisma.automation.delete({ where: { id: automationId } });

    return jsonbNoContent(ctx.requestId);
  },
);
