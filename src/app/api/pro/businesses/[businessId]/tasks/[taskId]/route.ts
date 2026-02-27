import { prisma } from '@/server/db/client';
import { BusinessReferenceType, TaskPhase, TaskStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, serverError } from '@/server/http/apiUtils';

function ensureTaskDelegate() {
  if (!(prisma as { task?: unknown }).task) {
    return serverError();
  }
  return null;
}

function isValidStatus(status: unknown): status is TaskStatus {
  return status === 'TODO' || status === 'IN_PROGRESS' || status === 'DONE';
}

async function validateCategoryAndTags(
  businessId: bigint,
  categoryReferenceId: bigint | null,
  tagReferenceIds?: bigint[]
): Promise<{ categoryId: bigint | null; tagIds: bigint[] } | { error: string }> {
  if (categoryReferenceId) {
    const category = await prisma.businessReference.findFirst({
      where: {
        id: categoryReferenceId,
        businessId,
        type: BusinessReferenceType.CATEGORY,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!category) return { error: 'categoryReferenceId invalide pour ce business.' };
  }

  let tagIds: bigint[] = [];
  if (tagReferenceIds && tagReferenceIds.length) {
    const tags = await prisma.businessReference.findMany({
      where: {
        id: { in: tagReferenceIds },
        businessId,
        type: BusinessReferenceType.TAG,
        isArchived: false,
      },
      select: { id: true },
    });
    if (tags.length !== tagReferenceIds.length) {
      return { error: 'tagReferenceIds invalides pour ce business.' };
    }
    tagIds = tags.map((t) => t.id);
  }

  return { categoryId: categoryReferenceId, tagIds };
}

function serializeTask(task: {
  id: bigint;
  businessId: bigint;
  projectId: bigint | null;
  projectServiceId?: bigint | null;
  projectServiceStepId?: bigint | null;
  parentTaskId?: bigint | null;
  assigneeUserId: bigint | null;
  title: string;
  phase: TaskPhase | null;
  status: TaskStatus;
  progress: number;
  dueDate: Date | null;
  completedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { name: string | null } | null;
  projectService?: { id: bigint; service: { name: string } } | null;
  projectServiceStep?: { id: bigint; name: string; phaseName: string | null; isBillableMilestone: boolean } | null;
  assignee?: { id: bigint; email: string; name: string | null } | null;
  categoryReferenceId?: bigint | null;
  categoryReference?: { id: bigint; name: string | null } | null;
  tags?: Array<{ referenceId: bigint; reference: { id: bigint; name: string } }>;
  _count?: { subtasks: number; checklistItems: number };
}) {
  return {
    id: task.id.toString(),
    businessId: task.businessId.toString(),
    projectId: task.projectId ? task.projectId.toString() : null,
    projectName: task.project?.name ?? null,
    projectServiceId: task.projectServiceId ? task.projectServiceId.toString() : null,
    projectServiceName: task.projectService?.service.name ?? null,
    projectServiceStepId: task.projectServiceStepId ? task.projectServiceStepId.toString() : null,
    projectServiceStepName: task.projectServiceStep?.name ?? null,
    projectServiceStepPhaseName: task.projectServiceStep?.phaseName ?? null,
    projectServiceStepIsBillableMilestone: task.projectServiceStep?.isBillableMilestone ?? false,
    parentTaskId: task.parentTaskId ? task.parentTaskId.toString() : null,
    assigneeUserId: task.assigneeUserId ? task.assigneeUserId.toString() : null,
    assigneeEmail: task.assignee?.email ?? null,
    assigneeName: task.assignee?.name ?? null,
    categoryReferenceId: task.categoryReferenceId ? task.categoryReferenceId.toString() : null,
    categoryReferenceName: task.categoryReference?.name ?? null,
    tagReferences: task.tags
      ? task.tags.map((tag) => ({
          id: tag.reference.id.toString(),
          name: tag.reference.name,
        }))
      : [],
    title: task.title,
    phase: task.phase,
    status: task.status,
    progress: task.progress,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    notes: task.notes,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    subtasksCount: typeof task._count?.subtasks === 'number' ? task._count.subtasks : undefined,
    checklistCount: typeof task._count?.checklistItems === 'number' ? task._count.checklistItems : undefined,
  };
}

// GET /api/pro/businesses/{businessId}/tasks/{taskId}
export const GET = withBusinessRoute<{ businessId: string; taskId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const delegateError = ensureTaskDelegate();
    if (delegateError) return delegateError;

    const taskId = params?.taskId;
    if (!taskId || !/^\d+$/.test(taskId)) return badRequest('taskId invalide.');
    const taskIdBigInt = BigInt(taskId);

    const task = await prisma.task.findFirst({
      where: { id: taskIdBigInt, businessId: businessIdBigInt },
      include: {
        project: { select: { name: true } },
        projectService: { select: { id: true, service: { select: { name: true } } } },
        projectServiceStep: {
          select: { id: true, name: true, phaseName: true, isBillableMilestone: true },
        },
        assignee: { select: { id: true, email: true, name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
        _count: { select: { subtasks: true, checklistItems: true } },
        subtasks: {
          include: {
            project: { select: { name: true } },
            projectService: { select: { id: true, service: { select: { name: true } } } },
            projectServiceStep: {
              select: { id: true, name: true, phaseName: true, isBillableMilestone: true },
            },
            assignee: { select: { id: true, email: true, name: true } },
            categoryReference: { select: { id: true, name: true } },
            tags: { include: { reference: { select: { id: true, name: true } } } },
            _count: { select: { subtasks: true, checklistItems: true } },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!task) return notFound('Tâche introuvable.');

    return jsonb(
      {
        item: serializeTask(task),
        subtasks: task.subtasks?.map(serializeTask) ?? [],
      },
      requestId
    );
  }
);

// PATCH /api/pro/businesses/{businessId}/tasks/{taskId}
export const PATCH = withBusinessRoute<{ businessId: string; taskId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:tasks:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt, userId } = ctx;

    const delegateError = ensureTaskDelegate();
    if (delegateError) return delegateError;

    const taskId = params?.taskId;
    if (!taskId || !/^\d+$/.test(taskId)) return badRequest('taskId invalide.');
    const taskIdBigInt = BigInt(taskId);

    const existing = await prisma.task.findFirst({
      where: { id: taskIdBigInt, businessId: businessIdBigInt },
      include: {
        project: { select: { name: true } },
        assignee: { select: { id: true, email: true, name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
    });
    if (!existing) return notFound('Tâche introuvable.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const data: Record<string, unknown> = {};

    if ('title' in body) {
      if (typeof (body as { title?: unknown }).title !== 'string') {
        return badRequest('title invalide.');
      }
      const trimmed = (body as { title: string }).title.trim();
      if (!trimmed) return badRequest('title ne peut pas être vide.');
      if (trimmed.length > 200) {
        return badRequest('title trop long (200 max).');
      }
      data.title = trimmed;
    }

    if ('phase' in body) {
      const phase = (body as { phase?: unknown }).phase;
      if (
        phase !== null &&
        phase !== undefined &&
        (typeof phase !== 'string' || !Object.values(TaskPhase).includes(phase as TaskPhase))
      ) {
        return badRequest('phase invalide.');
      }
      data.phase = (phase as TaskPhase | null) ?? null;
    }

    if ('status' in body) {
      if (!isValidStatus((body as { status?: unknown }).status)) {
        return badRequest('status invalide.');
      }
      data.status = (body as { status: TaskStatus }).status;
    }

    if ('progress' in body) {
      const progressRaw = (body as { progress?: unknown }).progress;
      if (typeof progressRaw !== 'number' || !Number.isFinite(progressRaw)) {
        return badRequest('progress invalide.');
      }
      const progress = Math.min(100, Math.max(0, Math.trunc(progressRaw)));
      data.progress = progress;
    }

    if ('projectId' in body) {
      const raw = (body as { projectId?: unknown }).projectId;
      if (raw === null || raw === undefined || raw === '') {
        data.projectId = null;
      } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
        const projectId = BigInt(raw);
        const project = await prisma.project.findFirst({
          where: { id: projectId, businessId: businessIdBigInt },
          select: { id: true },
        });
        if (!project) {
          return badRequest('projectId doit appartenir au business.');
        }
        data.projectId = projectId;
      } else {
        return badRequest('projectId invalide.');
      }
    }

    if ('projectServiceId' in body) {
      const raw = (body as { projectServiceId?: unknown }).projectServiceId;
      if (raw === null || raw === undefined || raw === '') {
        data.projectServiceId = null;
      } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
        const projectServiceId = BigInt(raw);
        const projectService = await prisma.projectService.findFirst({
          where: { id: projectServiceId },
          select: { projectId: true, project: { select: { businessId: true } } },
        });
        if (!projectService || projectService.project.businessId !== businessIdBigInt) {
          return badRequest('projectServiceId doit appartenir au business et au projet.');
        }
        if (data.projectId && data.projectId !== projectService.projectId) {
          return badRequest('projectServiceId doit appartenir au même projet.');
        }
        const targetProjectId = data.projectId ?? existing.projectId;
        if (targetProjectId && targetProjectId !== projectService.projectId) {
          return badRequest('projectServiceId doit appartenir au même projet.');
        }
        data.projectServiceId = projectServiceId;
      } else {
        return badRequest('projectServiceId invalide.');
      }
    }

    if ('assigneeUserId' in body) {
      const raw = (body as { assigneeUserId?: unknown }).assigneeUserId;
      if (raw === null || raw === undefined || raw === '') {
        data.assigneeUserId = null;
      } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
        const assigneeUserId = BigInt(raw);
        const membershipAssignee = await prisma.businessMembership.findUnique({
          where: { businessId_userId: { businessId: businessIdBigInt, userId: assigneeUserId } },
        });
        if (!membershipAssignee) {
          return badRequest('assigneeUserId doit être membre du business.');
        }
        data.assigneeUserId = assigneeUserId;
      } else {
        return badRequest('assigneeUserId invalide.');
      }
    }

    if ('dueDate' in body) {
      const raw = (body as { dueDate?: unknown }).dueDate;
      if (raw === null || raw === undefined || raw === '') {
        data.dueDate = null;
      } else if (typeof raw === 'string') {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          return badRequest('dueDate invalide.');
        }
        data.dueDate = parsed;
      } else {
        return badRequest('dueDate invalide.');
      }
    }

    if ('notes' in body) {
      const raw = (body as { notes?: unknown }).notes;
      if (raw === null || raw === undefined || raw === '') {
        data.notes = null;
      } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.length > 2000) {
          return badRequest('notes trop longues.');
        }
        data.notes = trimmed || null;
      } else {
        return badRequest('notes invalides.');
      }
    }

    const categoryProvided = Object.prototype.hasOwnProperty.call(body, 'categoryReferenceId');
    const categoryReferenceId =
      categoryProvided && typeof (body as { categoryReferenceId?: unknown }).categoryReferenceId === 'string'
        ? (() => {
            const raw = (body as { categoryReferenceId: string }).categoryReferenceId;
            return /^\d+$/.test(raw) ? BigInt(raw) : null;
          })()
        : categoryProvided
          ? null
          : undefined;

    const tagProvided = Object.prototype.hasOwnProperty.call(body, 'tagReferenceIds');
    const tagReferenceIds: bigint[] | undefined = tagProvided
      ? Array.from(
          new Set(
            ((Array.isArray((body as { tagReferenceIds?: unknown }).tagReferenceIds)
              ? (body as { tagReferenceIds: unknown[] }).tagReferenceIds
              : []) as unknown[])
              .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
              .map((id) => BigInt(id))
          )
        )
      : undefined;

    let tagsInstruction:
      | {
          deleteMany: { taskId: bigint };
          create: Array<{ referenceId: bigint }>;
        }
      | undefined;

    if (categoryProvided || tagProvided) {
      const validated = await validateCategoryAndTags(
        businessIdBigInt,
        categoryProvided ? categoryReferenceId ?? null : existing.categoryReferenceId ?? null,
        tagProvided ? tagReferenceIds : existing.tags?.map((t) => t.referenceId)
      );
      if ('error' in validated) {
        return badRequest(validated.error);
      }
      if (categoryProvided) {
        data.categoryReferenceId = validated.categoryId;
      }
      if (tagProvided) {
        tagsInstruction = {
          deleteMany: { taskId: taskIdBigInt },
          create: validated.tagIds.map((id) => ({ referenceId: id })),
        };
      }
    }

    if (!tagsInstruction && Object.keys(data).length === 0) {
      return badRequest('Aucune modification.');
    }

    if ('status' in data) {
      const newStatus = data.status as TaskStatus;
      if (newStatus === TaskStatus.DONE) {
        data.completedAt = new Date();
        data.progress = 100;
      } else if (existing.status === TaskStatus.DONE) {
        data.completedAt = null;
      }
      if (newStatus !== existing.status) {
        data.statusUpdatedAt = new Date();
        data.statusUpdatedByUserId = userId;
      }
    }

    const updated = await prisma.task.update({
      where: { id: taskIdBigInt },
      data,
      include: {
        project: { select: { name: true } },
        projectService: { select: { id: true, service: { select: { name: true } } } },
        projectServiceStep: {
          select: { id: true, name: true, phaseName: true, isBillableMilestone: true },
        },
        assignee: { select: { id: true, email: true, name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
      ...(tagsInstruction ? { data: { ...data, tags: tagsInstruction } } : {}),
    });

    return jsonb({ item: serializeTask(updated) }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/tasks/{taskId}
export const DELETE = withBusinessRoute<{ businessId: string; taskId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:tasks:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const delegateError = ensureTaskDelegate();
    if (delegateError) return delegateError;

    const taskId = params?.taskId;
    if (!taskId || !/^\d+$/.test(taskId)) return badRequest('taskId invalide.');
    const taskIdBigInt = BigInt(taskId);

    const task = await prisma.task.findFirst({
      where: { id: taskIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!task) return notFound('Tâche introuvable.');

    await prisma.task.delete({ where: { id: taskIdBigInt } });

    return jsonbNoContent(requestId);
  }
);
