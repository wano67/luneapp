import { prisma } from '@/server/db/client';
import { TaskPhase, TaskStatus } from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, forbidden, notFound } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';
import { parseIdOpt } from '@/server/http/parsers';
import { serializeTask } from '@/server/http/serializeTask';

function isValidStatus(status: unknown): status is TaskStatus {
  return status === 'TODO' || status === 'IN_PROGRESS' || status === 'DONE';
}

// GET /api/pro/businesses/{businessId}/tasks/{taskId}
export const GET = withBusinessRoute<{ businessId: string; taskId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const delegateError = ensureDelegate('task');
    if (delegateError) return delegateError;

    const taskIdBigInt = parseIdOpt(params?.taskId);
    if (!taskIdBigInt) return badRequest('taskId invalide.');

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
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:tasks:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt, userId } = ctx;

    const delegateError = ensureDelegate('task');
    if (delegateError) return delegateError;

    const taskIdBigInt = parseIdOpt(params?.taskId);
    if (!taskIdBigInt) return badRequest('taskId invalide.');

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

    const isMember = ctx.membership.role === 'MEMBER';
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    if (isMember) {
      if (existing.assigneeUserId !== userId) {
        return forbidden('Vous ne pouvez modifier que les tâches qui vous sont assignées.');
      }
      const allowedFields = new Set([
        'status', 'progress', 'notes', 'isBlocked', 'blockedReason', 'estimatedMinutes',
      ]);
      const bodyKeys = Object.keys(body as Record<string, unknown>);
      const disallowed = bodyKeys.filter((k) => !allowedFields.has(k));
      if (disallowed.length > 0) {
        return forbidden(`Champs non autorisés : ${disallowed.join(', ')}`);
      }
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

    if ('startDate' in body) {
      const raw = (body as { startDate?: unknown }).startDate;
      if (raw === null || raw === undefined || raw === '') {
        data.startDate = null;
      } else if (typeof raw === 'string') {
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) {
          return badRequest('startDate invalide.');
        }
        data.startDate = parsed;
      } else {
        return badRequest('startDate invalide.');
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

    if ('estimatedMinutes' in body) {
      const raw = (body as { estimatedMinutes?: unknown }).estimatedMinutes;
      if (raw === null || raw === undefined) {
        data.estimatedMinutes = null;
      } else if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && raw <= 99999) {
        data.estimatedMinutes = Math.trunc(raw);
      } else {
        return badRequest('estimatedMinutes invalide.');
      }
    }

    if ('isBlocked' in body) {
      const raw = (body as { isBlocked?: unknown }).isBlocked;
      if (typeof raw !== 'boolean') {
        return badRequest('isBlocked invalide.');
      }
      data.isBlocked = raw;
      if (!raw) data.blockedReason = null;
    }

    if ('blockedReason' in body) {
      const raw = (body as { blockedReason?: unknown }).blockedReason;
      if (raw === null || raw === undefined || raw === '') {
        data.blockedReason = null;
      } else if (typeof raw === 'string') {
        if (raw.trim().length > 500) return badRequest('blockedReason trop long (500 max).');
        data.blockedReason = raw.trim() || null;
      } else {
        return badRequest('blockedReason invalide.');
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

    const updateData = tagsInstruction ? { ...data, tags: tagsInstruction } : data;

    const updated = await prisma.task.update({
      where: { id: taskIdBigInt },
      data: updateData,
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

    const delegateError = ensureDelegate('task');
    if (delegateError) return delegateError;

    const taskIdBigInt = parseIdOpt(params?.taskId);
    if (!taskIdBigInt) return badRequest('taskId invalide.');

    const task = await prisma.task.findFirst({
      where: { id: taskIdBigInt, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!task) return notFound('Tâche introuvable.');

    await prisma.task.delete({ where: { id: taskIdBigInt } });

    return jsonbNoContent(requestId);
  }
);
