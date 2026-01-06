import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessReferenceType, TaskPhase, TaskStatus } from '@/generated/prisma';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

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

function ensureTaskDelegate(requestId: string) {
  if (!(prisma as { task?: unknown }).task) {
    return withIdNoStore(
      NextResponse.json(
        { error: 'Prisma client not generated / wrong import (task delegate absent).' },
        { status: 500 }
      ),
      requestId
    );
  }
  return null;
}

function serializeTask(task: {
  id: bigint;
  businessId: bigint;
  projectId: bigint | null;
  projectServiceId?: bigint | null;
  projectServiceStepId?: bigint | null;
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
  };
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

// GET /api/pro/businesses/{businessId}/tasks
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureTaskDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status') as TaskStatus | null;
  const statusFilter = statusParam && isValidStatus(statusParam) ? statusParam : null;
  const projectParam = searchParams.get('projectId');
  const projectIdFilter = projectParam ? parseId(projectParam) : null;
  if (projectParam && !projectIdFilter) {
    return withIdNoStore(badRequest('projectId invalide.'), requestId);
  }
  const phaseParam = searchParams.get('phase');
  const phaseFilter =
    phaseParam && Object.values(TaskPhase).includes(phaseParam as TaskPhase)
      ? (phaseParam as TaskPhase)
      : null;
  const assigneeParam = searchParams.get('assignee');
  const assigneeFilter = assigneeParam === 'me' ? BigInt(userId) : null;
  const categoryReferenceIdParam = searchParams.get('categoryReferenceId');
  const categoryReferenceId = categoryReferenceIdParam ? parseId(categoryReferenceIdParam) : null;
  if (categoryReferenceIdParam && !categoryReferenceId) {
    return withIdNoStore(badRequest('categoryReferenceId invalide.'), requestId);
  }
  const tagReferenceIdParam = searchParams.get('tagReferenceId');
  const tagReferenceId = tagReferenceIdParam ? parseId(tagReferenceIdParam) : null;
  if (tagReferenceIdParam && !tagReferenceId) {
    return withIdNoStore(badRequest('tagReferenceId invalide.'), requestId);
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
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return withIdNoStore(
    jsonNoStore({
      items: tasks.map(serializeTask),
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/tasks
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureTaskDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:tasks:create:${businessIdBigInt}:${userId}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || typeof (body as { title?: unknown }).title !== 'string') {
    return withIdNoStore(badRequest('title requis.'), requestId);
  }

  const title = (body as { title: string }).title.trim();
  if (!title) return withIdNoStore(badRequest('title ne peut pas être vide.'), requestId);
  if (title.length > 200) return withIdNoStore(badRequest('title trop long (200 max).'), requestId);

  let status: TaskStatus = TaskStatus.TODO;
  if ('status' in body) {
    if (!isValidStatus((body as { status?: unknown }).status)) {
      return withIdNoStore(badRequest('status invalide.'), requestId);
    }
    status = (body as { status: TaskStatus }).status;
  }

  let projectId: bigint | undefined;
  if ('projectId' in body && (body as { projectId?: unknown }).projectId) {
    const raw = (body as { projectId?: unknown }).projectId;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      return withIdNoStore(badRequest('projectId invalide.'), requestId);
    }
    projectId = BigInt(raw);
    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) {
      return withIdNoStore(badRequest('projectId doit appartenir au business.'), requestId);
    }
  }

  let assigneeUserId: bigint | undefined;
  if ('assigneeUserId' in body && (body as { assigneeUserId?: unknown }).assigneeUserId) {
    const raw = (body as { assigneeUserId?: unknown }).assigneeUserId;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
      return withIdNoStore(badRequest('assigneeUserId invalide.'), requestId);
    }
    assigneeUserId = BigInt(raw);
    const membershipAssignee = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: assigneeUserId } },
    });
    if (!membershipAssignee) {
      return withIdNoStore(badRequest('assigneeUserId doit être membre du business.'), requestId);
    }
  }

  let dueDate: Date | undefined;
  if ('dueDate' in body && (body as { dueDate?: unknown }).dueDate) {
    const raw = (body as { dueDate?: unknown }).dueDate;
    if (typeof raw !== 'string') {
      return withIdNoStore(badRequest('dueDate invalide.'), requestId);
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return withIdNoStore(badRequest('dueDate invalide.'), requestId);
    }
    dueDate = parsed;
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
    return withIdNoStore(badRequest(validated.error), requestId);
  }

  const task = await prisma.task.create({
    data: {
      businessId: businessIdBigInt,
      projectId,
      assigneeUserId,
      title,
      status,
      progress: status === TaskStatus.DONE ? 100 : undefined,
      completedAt: status === TaskStatus.DONE ? new Date() : undefined,
      dueDate,
      categoryReferenceId: validated.categoryId ?? undefined,
      tags:
        validated.tagIds.length > 0
          ? {
              create: validated.tagIds.map((id) => ({ referenceId: id })),
            }
          : undefined,
    },
    include: {
      project: { select: { name: true } },
      assignee: { select: { id: true, email: true, name: true } },
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return withIdNoStore(jsonNoStore({ item: serializeTask(task) }, { status: 201 }), requestId);
}
