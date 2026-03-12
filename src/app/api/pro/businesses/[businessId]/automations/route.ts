import { prisma } from '@/server/db/client';
import { AutomationTrigger, AutomationAction, type Prisma } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
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

// GET /api/pro/businesses/{businessId}/automations
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx) => {
    const items = await prisma.automation.findMany({
      where: { businessId: ctx.businessId },
      orderBy: { createdAt: 'desc' },
    });
    return jsonb({ items: items.map(serialize) }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/automations
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:automations:create:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Payload invalide.');

    const { name, trigger, action, config, projectId, enabled } = body as Record<string, unknown>;

    if (typeof name !== 'string' || !name.trim()) return badRequest('name requis.');
    if (name.trim().length > 200) return badRequest('name trop long (200 max).');
    if (!VALID_TRIGGERS.includes(trigger as AutomationTrigger)) return badRequest('trigger invalide.');
    if (!VALID_ACTIONS.includes(action as AutomationAction)) return badRequest('action invalide.');

    let projectIdBigInt: bigint | null = null;
    if (projectId) {
      projectIdBigInt = parseIdOpt(projectId as string);
      if (!projectIdBigInt) return badRequest('projectId invalide.');
      const project = await prisma.project.findFirst({
        where: { id: projectIdBigInt, businessId: ctx.businessId },
        select: { id: true },
      });
      if (!project) return badRequest('Projet introuvable.');
    }

    const automation = await prisma.automation.create({
      data: {
        businessId: ctx.businessId,
        projectId: projectIdBigInt,
        name: name.trim(),
        trigger: trigger as AutomationTrigger,
        action: action as AutomationAction,
        config: (config && typeof config === 'object' ? config : {}) as Prisma.InputJsonValue,
        enabled: typeof enabled === 'boolean' ? enabled : true,
      },
    });

    return jsonbCreated({ item: serialize(automation) }, ctx.requestId);
  },
);
