import { prisma } from '@/server/db/client';
import { TaskPhase, TaskStatus } from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';
import { parseIdOpt } from '@/server/http/parsers';
import { serializeTask } from '@/server/http/serializeTask';
import { notifyTaskAssigned, notifyPoleAssigned } from '@/server/services/notifications';

function isValidStatus(status: unknown): status is TaskStatus {
  return status === 'TODO' || status === 'IN_PROGRESS' || status === 'DONE';
}

// GET /api/pro/businesses/{businessId}/tasks
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const { requestId, businessId: businessIdBigInt, userId } = ctx;

    const delegateError = ensureDelegate('task');
    if (delegateError) return delegateError;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status') as TaskStatus | null;
    const statusFilter = statusParam && isValidStatus(statusParam) ? statusParam : null;
    const projectParam = searchParams.get('projectId');
    const projectIdFilter = projectParam ? parseIdOpt(projectParam) : null;
    if (projectParam && !projectIdFilter) {
      return badRequest('projectId invalide.');
    }
    const phaseParam = searchParams.get('phase');
    const phaseFilter =
      phaseParam && Object.values(TaskPhase).includes(phaseParam as TaskPhase)
        ? (phaseParam as TaskPhase)
        : null;
    const assigneeParam = searchParams.get('assignee');
    const assigneeFilter = assigneeParam === 'me' ? userId : null;
    const categoryReferenceIdParam = searchParams.get('categoryReferenceId');
    const categoryReferenceId = categoryReferenceIdParam ? parseIdOpt(categoryReferenceIdParam) : null;
    if (categoryReferenceIdParam && !categoryReferenceId) {
      return badRequest('categoryReferenceId invalide.');
    }
    const tagReferenceIdParam = searchParams.get('tagReferenceId');
    const tagReferenceId = tagReferenceIdParam ? parseIdOpt(tagReferenceIdParam) : null;
    if (tagReferenceIdParam && !tagReferenceId) {
      return badRequest('tagReferenceId invalide.');
    }

    const tasks = await prisma.task.findMany({
      where: {
        businessId: businessIdBigInt,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
        ...(phaseFilter ? { phase: phaseFilter } : {}),
        ...(assigneeFilter ? { assigneeUserId: assigneeFilter } : {}),
        ...(categoryReferenceId ? { categoryReferenceId } : {}),
        ...(tagReferenceId ? { tags: { some: { referenceId: tagReferenceId } } } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        project: { select: { name: true } },
        projectService: { select: { id: true, service: { select: { name: true } } } },
        projectServiceStep: {
          select: { id: true, name: true, phaseName: true, isBillableMilestone: true },
        },
        assignee: { select: { id: true, email: true, name: true } },
        organizationUnit: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { assignedAt: 'asc' as const } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
        _count: { select: { subtasks: true, checklistItems: true } },
        checklistItems: { select: { isCompleted: true } },
      },
    });

    return jsonb({ items: tasks.map(serializeTask) }, requestId);
  }
);

// POST /api/pro/businesses/{businessId}/tasks
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'MEMBER',
    rateLimit: {
      key: (ctx) => `pro:tasks:create:${ctx.businessId}:${ctx.userId}`,
      limit: 200,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const delegateError = ensureDelegate('task');
    if (delegateError) return delegateError;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || typeof (body as { title?: unknown }).title !== 'string') {
      return badRequest('title requis.');
    }

    const title = (body as { title: string }).title.trim();
    if (!title) return badRequest('title ne peut pas être vide.');
    if (title.length > 200) return badRequest('title trop long (200 max).');

    let status: TaskStatus = TaskStatus.TODO;
    if ('status' in body) {
      if (!isValidStatus((body as { status?: unknown }).status)) {
        return badRequest('status invalide.');
      }
      status = (body as { status: TaskStatus }).status;
    }

    let parentTaskId: bigint | undefined;
    let parentTask: { projectId: bigint | null; projectServiceId: bigint | null } | null = null;
    if ('parentTaskId' in body && (body as { parentTaskId?: unknown }).parentTaskId) {
      const raw = (body as { parentTaskId?: unknown }).parentTaskId;
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        return badRequest('parentTaskId invalide.');
      }
      parentTaskId = BigInt(raw);
      parentTask = await prisma.task.findFirst({
        where: { id: parentTaskId, businessId: businessIdBigInt },
        select: { projectId: true, projectServiceId: true },
      });
      if (!parentTask) {
        return badRequest('parentTaskId doit appartenir au business.');
      }
    }

    let projectId: bigint | undefined;
    if ('projectId' in body && (body as { projectId?: unknown }).projectId) {
      const raw = (body as { projectId?: unknown }).projectId;
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        return badRequest('projectId invalide.');
      }
      projectId = BigInt(raw);
      const project = await prisma.project.findFirst({
        where: { id: projectId, businessId: businessIdBigInt },
        select: { id: true },
      });
      if (!project) {
        return badRequest('projectId doit appartenir au business.');
      }
    }
    if (parentTask?.projectId) {
      if (projectId && projectId !== parentTask.projectId) {
        return badRequest('parentTaskId doit appartenir au même projet.');
      }
      projectId = parentTask.projectId;
    }

    let projectServiceId: bigint | undefined;
    if ('projectServiceId' in body && (body as { projectServiceId?: unknown }).projectServiceId) {
      const raw = (body as { projectServiceId?: unknown }).projectServiceId;
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        return badRequest('projectServiceId invalide.');
      }
      projectServiceId = BigInt(raw);
      const projectService = await prisma.projectService.findFirst({
        where: { id: projectServiceId },
        select: { projectId: true, project: { select: { businessId: true } } },
      });
      if (!projectService || projectService.project.businessId !== businessIdBigInt) {
        return badRequest('projectServiceId doit appartenir au business.');
      }
      if (projectId && projectId !== projectService.projectId) {
        return badRequest('projectServiceId doit appartenir au même projet.');
      }
      if (!projectId) {
        projectId = projectService.projectId;
      }
    }
    if (parentTask?.projectServiceId) {
      if (projectServiceId && projectServiceId !== parentTask.projectServiceId) {
        return badRequest('parentTaskId doit appartenir au même service projet.');
      }
      projectServiceId = projectServiceId ?? parentTask.projectServiceId;
    }

    let assigneeUserId: bigint | undefined;
    if ('assigneeUserId' in body && (body as { assigneeUserId?: unknown }).assigneeUserId) {
      const raw = (body as { assigneeUserId?: unknown }).assigneeUserId;
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        return badRequest('assigneeUserId invalide.');
      }
      assigneeUserId = BigInt(raw);
      const membershipAssignee = await prisma.businessMembership.findUnique({
        where: { businessId_userId: { businessId: businessIdBigInt, userId: assigneeUserId } },
      });
      if (!membershipAssignee) {
        return badRequest('assigneeUserId doit être membre du business.');
      }
    } else if ((body as { assignToSelf?: boolean }).assignToSelf) {
      assigneeUserId = ctx.userId;
    }

    let dueDate: Date | undefined;
    if ('dueDate' in body && (body as { dueDate?: unknown }).dueDate) {
      const raw = (body as { dueDate?: unknown }).dueDate;
      if (typeof raw !== 'string') {
        return badRequest('dueDate invalide.');
      }
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return badRequest('dueDate invalide.');
      }
      dueDate = parsed;
    }

    let startDate: Date | undefined;
    if ('startDate' in body && (body as { startDate?: unknown }).startDate) {
      const raw = (body as { startDate?: unknown }).startDate;
      if (typeof raw !== 'string') {
        return badRequest('startDate invalide.');
      }
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return badRequest('startDate invalide.');
      }
      startDate = parsed;
    }

    let organizationUnitId: bigint | undefined;
    if ('organizationUnitId' in body && (body as { organizationUnitId?: unknown }).organizationUnitId) {
      const raw = (body as { organizationUnitId?: unknown }).organizationUnitId;
      if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        return badRequest('organizationUnitId invalide.');
      }
      organizationUnitId = BigInt(raw);
      const unit = await prisma.organizationUnit.findFirst({
        where: { id: organizationUnitId, businessId: businessIdBigInt },
        select: { id: true },
      });
      if (!unit) return badRequest('organizationUnitId doit appartenir au business.');
    }

    let assigneeUserIds: bigint[] | undefined;
    if ('assigneeUserIds' in body && Array.isArray((body as { assigneeUserIds?: unknown }).assigneeUserIds)) {
      const rawIds = (body as { assigneeUserIds: unknown[] }).assigneeUserIds;
      const parsed: bigint[] = [];
      for (const raw of rawIds) {
        if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
          return badRequest('assigneeUserIds contient un id invalide.');
        }
        parsed.push(BigInt(raw));
      }
      if (parsed.length > 0) {
        const count = await prisma.businessMembership.count({
          where: { businessId: businessIdBigInt, userId: { in: parsed } },
        });
        if (count !== parsed.length) {
          return badRequest('Tous les assigneeUserIds doivent être membres du business.');
        }
        assigneeUserIds = parsed;
        // Use first as primary assignee if none specified
        if (!assigneeUserId) assigneeUserId = parsed[0];
      }
    }

    let estimatedMinutes: number | undefined;
    if ('estimatedMinutes' in body) {
      const raw = (body as { estimatedMinutes?: unknown }).estimatedMinutes;
      if (raw !== null && raw !== undefined) {
        if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || raw > 99999) {
          return badRequest('estimatedMinutes invalide.');
        }
        estimatedMinutes = Math.trunc(raw);
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

    const validated = await validateCategoryAndTags(businessIdBigInt, categoryReferenceId ?? null, tagReferenceIds);
    if ('error' in validated) {
      return badRequest(validated.error);
    }

    const effectiveStartDate = startDate;

    const task = await prisma.task.create({
      data: {
        businessId: businessIdBigInt,
        projectId,
        projectServiceId,
        parentTaskId,
        assigneeUserId,
        organizationUnitId,
        title,
        status,
        progress: status === TaskStatus.DONE ? 100 : undefined,
        completedAt: status === TaskStatus.DONE ? new Date() : undefined,
        dueDate,
        startDate: effectiveStartDate,
        estimatedMinutes,
        categoryReferenceId: validated.categoryId ?? undefined,
        tags:
          validated.tagIds.length > 0
            ? {
                create: validated.tagIds.map((id) => ({ referenceId: id })),
              }
            : undefined,
        assignees:
          assigneeUserIds && assigneeUserIds.length > 0
            ? { create: assigneeUserIds.map((uid) => ({ userId: uid })) }
            : undefined,
      },
      include: {
        project: { select: { name: true } },
        projectService: { select: { id: true, service: { select: { name: true } } } },
        projectServiceStep: {
          select: { id: true, name: true, phaseName: true, isBillableMilestone: true },
        },
        assignee: { select: { id: true, email: true, name: true } },
        organizationUnit: { select: { id: true, name: true } },
        assignees: { include: { user: { select: { id: true, email: true, name: true } } }, orderBy: { assignedAt: 'asc' as const } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
        _count: { select: { subtasks: true, checklistItems: true } },
      },
    });

    // Fire-and-forget notifications
    if (assigneeUserIds && assigneeUserIds.length > 0) {
      void notifyTaskAssigned(assigneeUserIds, ctx.userId, businessIdBigInt, title, task.id, projectId ?? null);
    } else if (assigneeUserId) {
      void notifyTaskAssigned([assigneeUserId], ctx.userId, businessIdBigInt, title, task.id, projectId ?? null);
    }
    if (organizationUnitId) {
      void notifyPoleAssigned(organizationUnitId, ctx.userId, businessIdBigInt, title, task.id, projectId ?? null);
    }

    return jsonbCreated({ item: serializeTask(task) }, requestId);
  }
);
