import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { TaskStatus } from '@/generated/prisma/client';
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
  assigneeUserId: bigint | null;
  title: string;
  status: TaskStatus;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { name: string | null } | null;
  assignee?: { id: bigint; email: string; name: string | null } | null;
}) {
  return {
    id: task.id.toString(),
    businessId: task.businessId.toString(),
    projectId: task.projectId ? task.projectId.toString() : null,
    projectName: task.project?.name ?? null,
    assigneeUserId: task.assigneeUserId ? task.assigneeUserId.toString() : null,
    assigneeEmail: task.assignee?.email ?? null,
    assigneeName: task.assignee?.name ?? null,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function isValidStatus(status: unknown): status is TaskStatus {
  return status === 'TODO' || status === 'IN_PROGRESS' || status === 'DONE';
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

  const tasks = await prisma.task.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    include: {
      project: { select: { name: true } },
      assignee: { select: { id: true, email: true, name: true } },
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

  const task = await prisma.task.create({
    data: {
      businessId: businessIdBigInt,
      projectId,
      assigneeUserId,
      title,
      status,
      dueDate,
    },
    include: {
      project: { select: { name: true } },
      assignee: { select: { id: true, email: true, name: true } },
    },
  });

  return withIdNoStore(jsonNoStore({ item: serializeTask(task) }, { status: 201 }), requestId);
}
