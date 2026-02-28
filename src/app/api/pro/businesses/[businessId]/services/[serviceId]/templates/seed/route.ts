import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { notFound } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { TaskPhase } from '@/generated/prisma';

async function ensureService(businessId: bigint, serviceId: bigint) {
  return prisma.service.findFirst({ where: { id: serviceId, businessId }, select: { id: true } });
}

type SeedTemplate = {
  phase: TaskPhase;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

const STANDARD_PACK: SeedTemplate[] = [
  { phase: 'CADRAGE', title: 'Kickoff et objectifs', defaultAssigneeRole: 'PM', defaultDueOffsetDays: 0 },
  { phase: 'UX', title: 'Interviews utilisateurs', defaultAssigneeRole: 'UX', defaultDueOffsetDays: 5 },
  { phase: 'DESIGN', title: 'Wireframes clés', defaultAssigneeRole: 'Design', defaultDueOffsetDays: 10 },
  { phase: 'DEV', title: 'Setup technique & CI', defaultAssigneeRole: 'Lead Dev', defaultDueOffsetDays: 12 },
  { phase: 'SEO', title: 'Checklist SEO', defaultAssigneeRole: 'SEO', defaultDueOffsetDays: 18 },
  { phase: 'LAUNCH', title: 'Recette & go-live', defaultAssigneeRole: 'Ops', defaultDueOffsetDays: 25 },
  { phase: 'FOLLOW_UP', title: 'Suivi post-lancement', defaultAssigneeRole: 'CSM', defaultDueOffsetDays: 30 },
];

// POST /api/pro/businesses/{businessId}/services/{serviceId}/templates/seed
export const POST = withBusinessRoute<{ businessId: string; serviceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:services:templates:seed:${ctx.businessId}:${ctx.userId}`,
      limit: 50,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const serviceId = parseId(params.serviceId);

    const service = await ensureService(ctx.businessId, serviceId);
    if (!service) return notFound('Service introuvable.');

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.serviceTaskTemplate.findMany({
        where: { serviceId, service: { businessId: ctx.businessId } },
        select: { title: true, phase: true },
      });
      const existingKeys = new Set(existing.map((tpl) => `${tpl.phase ?? ''}|${tpl.title.toLowerCase()}`));

      const toCreate = STANDARD_PACK.filter((tpl) => {
        const key = `${tpl.phase ?? ''}|${tpl.title.toLowerCase()}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      }).map((tpl) => ({
        serviceId,
        phase: tpl.phase,
        title: tpl.title,
        defaultAssigneeRole: tpl.defaultAssigneeRole ?? undefined,
        defaultDueOffsetDays: tpl.defaultDueOffsetDays ?? undefined,
      }));

      if (toCreate.length) {
        await tx.serviceTaskTemplate.createMany({ data: toCreate, skipDuplicates: true });
      }

      return { createdCount: toCreate.length, skippedCount: STANDARD_PACK.length - toCreate.length };
    });

    return jsonb(result, ctx.requestId);
  }
);
