import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

type TaskTplInput = {
  title: string;
  order: number;
  description: string | null;
  dueOffsetDays: number | null;
  defaultAssigneeRole: string | null;
};

type StepTplInput = {
  name: string;
  order: number;
  isBillableMilestone: boolean;
  tasks: TaskTplInput[];
};

type PhaseTplInput = {
  name: string;
  order: number;
  steps: StepTplInput[];
};

type TemplateInput = {
  name: string;
  phases: PhaseTplInput[];
};

function normalizeStr(value: unknown) {
  return String(value ?? '').trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function toInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function validateTemplate(body: unknown): TemplateInput | { error: string } {
  if (!isRecord(body)) return { error: 'Payload invalide.' };
  const name = normalizeStr(body.name || '');
  if (name && name.length > 140) return { error: 'Nom trop long (140 max).' };

  if (!Array.isArray(body.phases)) return { error: 'phases doit être un tableau.' };
  if (body.phases.length > 20) return { error: 'Trop de phases (20 max).' };

  let stepCount = 0;
  let taskCount = 0;

  const phases: PhaseTplInput[] = [];
  for (const phaseRaw of body.phases) {
    if (!isRecord(phaseRaw)) return { error: 'Phase invalide.' };
    const phaseName = normalizeStr(phaseRaw.name);
    if (!phaseName) return { error: 'Nom de phase requis.' };
    if (phaseName.length > 140) return { error: 'Nom de phase trop long (140 max).' };
    const order = toInt(phaseRaw.order);
    if (order === null || order < 0 || order > 1000) return { error: 'Ordre de phase invalide (0-1000).' };

    if (!Array.isArray(phaseRaw.steps)) return { error: 'steps doit être un tableau.' };
    if (phaseRaw.steps.length > 200) return { error: 'Trop d\u2019\u00e9tapes (200 max).' };

    const steps: StepTplInput[] = [];
    for (const stepRaw of phaseRaw.steps) {
      if (!isRecord(stepRaw)) return { error: '\u00c9tape invalide.' };
      const stepName = normalizeStr(stepRaw.name);
      if (!stepName) return { error: 'Nom d\u2019\u00e9tape requis.' };
      if (stepName.length > 140) return { error: 'Nom d\u2019\u00e9tape trop long (140 max).' };
      const stepOrder = toInt(stepRaw.order);
      if (stepOrder === null || stepOrder < 0 || stepOrder > 5000) {
        return { error: 'Ordre d\u2019\u00e9tape invalide (0-5000).' };
      }
      const isBillableMilestone = Boolean(stepRaw.isBillableMilestone);

      if (!Array.isArray(stepRaw.tasks)) return { error: 'tasks doit être un tableau.' };
      if (stepRaw.tasks.length > 2000) return { error: 'Trop de tâches (2000 max).' };

      const tasks: TaskTplInput[] = [];
      for (const taskRaw of stepRaw.tasks) {
        if (!isRecord(taskRaw)) return { error: 'Tâche invalide.' };
        const title = normalizeStr(taskRaw.title);
        if (!title) return { error: 'Titre de tâche requis.' };
        if (title.length > 200) return { error: 'Titre de tâche trop long (200 max).' };
        const taskOrder = toInt(taskRaw.order);
        if (taskOrder === null || taskOrder < 0 || taskOrder > 5000) {
          return { error: 'Ordre de tâche invalide (0-5000).' };
        }
        let dueOffset: number | null = null;
        if (taskRaw.dueOffsetDays !== undefined) {
          if (taskRaw.dueOffsetDays === null) {
            dueOffset = null;
          } else {
            const parsed = toInt(taskRaw.dueOffsetDays);
            if (parsed === null || parsed < -365 || parsed > 365) {
              return { error: 'dueOffsetDays doit être entre -365 et 365.' };
            }
            dueOffset = parsed;
          }
        }
        const desc = taskRaw.description === undefined ? null : normalizeStr(taskRaw.description);
        const role = taskRaw.defaultAssigneeRole === undefined ? null : normalizeStr(taskRaw.defaultAssigneeRole);
        if (role && role.length > 60) return { error: 'defaultAssigneeRole trop long (60 max).' };

        tasks.push({
          title,
          order: taskOrder,
          description: desc || null,
          dueOffsetDays: dueOffset,
          defaultAssigneeRole: role || null,
        });
      }

      stepCount += 1;
      taskCount += tasks.length;
      steps.push({ name: stepName, order: stepOrder, isBillableMilestone, tasks });
    }

    phases.push({ name: phaseName, order, steps });
  }

  if (stepCount > 200) return { error: 'Trop d\u2019\u00e9tapes (200 max).' };
  if (taskCount > 2000) return { error: 'Trop de tâches (2000 max).' };

  return { name: name || 'Process service', phases };
}

async function ensureService(businessId: bigint, serviceId: bigint) {
  return prisma.service.findFirst({
    where: { id: serviceId, businessId },
    select: { id: true, name: true },
  });
}

// GET /api/pro/businesses/{businessId}/services/{serviceId}/process-template
export const GET = withBusinessRoute<{ businessId: string; serviceId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const serviceId = parseId(params.serviceId);

    const service = await ensureService(ctx.businessId, serviceId);
    if (!service) return notFound('Service introuvable.');

    const tpl = await prisma.serviceProcessTemplate.findFirst({
      where: { serviceId, businessId: ctx.businessId },
      include: {
        phases: {
          orderBy: { order: 'asc' },
          include: {
            steps: {
              orderBy: { order: 'asc' },
              include: { tasks: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    });

    return jsonb({ item: tpl ?? null }, ctx.requestId);
  }
);

// PUT /api/pro/businesses/{businessId}/services/{serviceId}/process-template
export const PUT = withBusinessRoute<{ businessId: string; serviceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:services:process-template:upsert:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const serviceId = parseId(params.serviceId);

    const body = await readJson(req);
    const parsed = validateTemplate(body);
    if ('error' in parsed) return badRequest(parsed.error);

    const service = await ensureService(ctx.businessId, serviceId);
    if (!service) return notFound('Service introuvable.');

    const created = await prisma.$transaction(async (tx) => {
      const existing = await tx.serviceProcessTemplate.findFirst({
        where: { serviceId, businessId: ctx.businessId },
        select: { id: true },
      });
      if (existing) {
        await tx.serviceProcessTemplate.delete({ where: { id: existing.id } });
      }

      return tx.serviceProcessTemplate.create({
        data: {
          businessId: ctx.businessId,
          serviceId,
          name: parsed.name || service.name,
          phases: {
            create: parsed.phases.map((phase) => ({
              name: phase.name,
              order: phase.order,
              steps: {
                create: phase.steps.map((step) => ({
                  name: step.name,
                  order: step.order,
                  isBillableMilestone: step.isBillableMilestone,
                  tasks: {
                    create: step.tasks.map((task) => ({
                      title: task.title,
                      order: task.order,
                      description: task.description ?? undefined,
                      dueOffsetDays: task.dueOffsetDays ?? undefined,
                      defaultAssigneeRole: task.defaultAssigneeRole ?? undefined,
                    })),
                  },
                })),
              },
            })),
          },
        },
        include: {
          phases: {
            orderBy: { order: 'asc' },
            include: {
              steps: {
                orderBy: { order: 'asc' },
                include: { tasks: { orderBy: { order: 'asc' } } },
              },
            },
          },
        },
      });
    });

    return jsonb({ item: created }, ctx.requestId);
  }
);
