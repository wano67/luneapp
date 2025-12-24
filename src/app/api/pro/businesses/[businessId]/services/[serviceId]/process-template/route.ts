import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function forbidden(requestId: string) {
  return withIdNoStore(NextResponse.json({ error: 'Forbidden' }, { status: 403 }), requestId);
}

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
    if (phaseRaw.steps.length > 200) return { error: 'Trop d’étapes (200 max).' };

    const steps: StepTplInput[] = [];
    for (const stepRaw of phaseRaw.steps) {
      if (!isRecord(stepRaw)) return { error: 'Étape invalide.' };
      const stepName = normalizeStr(stepRaw.name);
      if (!stepName) return { error: 'Nom d’étape requis.' };
      if (stepName.length > 140) return { error: 'Nom d’étape trop long (140 max).' };
      const stepOrder = toInt(stepRaw.order);
      if (stepOrder === null || stepOrder < 0 || stepOrder > 5000) {
        return { error: 'Ordre d’étape invalide (0-5000).' };
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

  if (stepCount > 200) return { error: 'Trop d’étapes (200 max).' };
  if (taskCount > 2000) return { error: 'Trop de tâches (2000 max).' };

  return { name: name || 'Process service', phases };
}

function serializeTemplate(template: {
  id: bigint;
  name: string;
  phases: Array<{
    id: bigint;
    name: string;
    order: number;
    steps: Array<{
      id: bigint;
      name: string;
      order: number;
      isBillableMilestone: boolean;
      tasks: Array<{
        id: bigint;
        title: string;
        order: number;
        description: string | null;
        dueOffsetDays: number | null;
        defaultAssigneeRole: string | null;
      }>;
    }>;
  }>;
}) {
  return {
    id: template.id.toString(),
    name: template.name,
    phases: template.phases.map((phase) => ({
      id: phase.id.toString(),
      name: phase.name,
      order: phase.order,
      steps: phase.steps.map((step) => ({
        id: step.id.toString(),
        name: step.name,
        order: step.order,
        isBillableMilestone: step.isBillableMilestone,
        tasks: step.tasks.map((task) => ({
          id: task.id.toString(),
          title: task.title,
          order: task.order,
          description: task.description,
          dueOffsetDays: task.dueOffsetDays,
          defaultAssigneeRole: task.defaultAssigneeRole,
        })),
      })),
    })),
  };
}

async function ensureService(businessId: bigint, serviceId: bigint) {
  return prisma.service.findFirst({
    where: { id: serviceId, businessId },
    select: { id: true, name: true },
  });
}

// GET /api/pro/businesses/{businessId}/services/{serviceId}/process-template
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
) {
  const requestId = getRequestId(request);
  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return forbidden(requestId);

  const service = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!service) {
    return withIdNoStore(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  const tpl = await prisma.serviceProcessTemplate.findFirst({
    where: { serviceId: serviceIdBigInt, businessId: businessIdBigInt },
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

  return withIdNoStore(
    jsonNoStore({ item: tpl ? serializeTemplate(tpl) : null }),
    requestId
  );
}

// PUT /api/pro/businesses/{businessId}/services/{serviceId}/process-template
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; serviceId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const { businessId, serviceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const serviceIdBigInt = parseId(serviceId);
  if (!businessIdBigInt || !serviceIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const limited = rateLimit(request, {
    key: `pro:services:process-template:upsert:${businessIdBigInt}:${serviceIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  const parsed = validateTemplate(body);
  if ('error' in parsed) return withIdNoStore(badRequest(parsed.error), requestId);

  const service = await ensureService(businessIdBigInt, serviceIdBigInt);
  if (!service) {
    return withIdNoStore(NextResponse.json({ error: 'Service introuvable.' }, { status: 404 }), requestId);
  }

  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.serviceProcessTemplate.findFirst({
      where: { serviceId: serviceIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (existing) {
      await tx.serviceProcessTemplate.delete({ where: { id: existing.id } });
    }

    return tx.serviceProcessTemplate.create({
      data: {
        businessId: businessIdBigInt,
        serviceId: serviceIdBigInt,
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

  return withIdNoStore(
    jsonNoStore({ item: serializeTemplate(created) }),
    requestId
  );
}
