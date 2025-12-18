import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { TaskPhase, TaskStatus } from '@/generated/prisma/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
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

function isValidStatus(status: unknown): status is TaskStatus {
  return status === 'TODO' || status === 'IN_PROGRESS' || status === 'DONE';
}

function serializeTask(task: {
  id: bigint;
  businessId: bigint;
  projectId: bigint | null;
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

// GET /api/pro/businesses/{businessId}/tasks/{taskId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; taskId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, taskId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureTaskDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  const taskIdBigInt = parseId(taskId);
  if (!businessIdBigInt || !taskIdBigInt) {
    return withIdNoStore(badRequest('businessId ou taskId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const task = await prisma.task.findFirst({
    where: { id: taskIdBigInt, businessId: businessIdBigInt },
    include: {
      project: { select: { name: true } },
      assignee: { select: { id: true, email: true, name: true } },
    },
  });

  if (!task) return withIdNoStore(notFound('Tâche introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ item: serializeTask(task) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/tasks/{taskId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; taskId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, taskId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const taskIdBigInt = parseId(taskId);
  if (!businessIdBigInt || !taskIdBigInt) {
    return withIdNoStore(badRequest('businessId ou taskId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureTaskDelegate(requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const existing = await prisma.task.findFirst({
    where: { id: taskIdBigInt, businessId: businessIdBigInt },
    include: {
      project: { select: { name: true } },
      assignee: { select: { id: true, email: true, name: true } },
    },
  });
  if (!existing) return withIdNoStore(notFound('Tâche introuvable.'), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if ('title' in body) {
    if (typeof (body as { title?: unknown }).title !== 'string') {
      return withIdNoStore(badRequest('title invalide.'), requestId);
    }
    const trimmed = (body as { title: string }).title.trim();
    if (!trimmed) return withIdNoStore(badRequest('title ne peut pas être vide.'), requestId);
    if (trimmed.length > 200) {
      return withIdNoStore(badRequest('title trop long (200 max).'), requestId);
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
      return withIdNoStore(badRequest('phase invalide.'), requestId);
    }
    data.phase = (phase as TaskPhase | null) ?? null;
  }

  if ('status' in body) {
    if (!isValidStatus((body as { status?: unknown }).status)) {
      return withIdNoStore(badRequest('status invalide.'), requestId);
    }
    data.status = (body as { status: TaskStatus }).status;
  }

  if ('progress' in body) {
    const progressRaw = (body as { progress?: unknown }).progress;
    if (typeof progressRaw !== 'number' || !Number.isFinite(progressRaw)) {
      return withIdNoStore(badRequest('progress invalide.'), requestId);
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
        return withIdNoStore(badRequest('projectId doit appartenir au business.'), requestId);
      }
      data.projectId = projectId;
    } else {
      return withIdNoStore(badRequest('projectId invalide.'), requestId);
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
        return withIdNoStore(badRequest('assigneeUserId doit être membre du business.'), requestId);
      }
      data.assigneeUserId = assigneeUserId;
    } else {
      return withIdNoStore(badRequest('assigneeUserId invalide.'), requestId);
    }
  }

  if ('dueDate' in body) {
    const raw = (body as { dueDate?: unknown }).dueDate;
    if (raw === null || raw === undefined || raw === '') {
      data.dueDate = null;
    } else if (typeof raw === 'string') {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        return withIdNoStore(badRequest('dueDate invalide.'), requestId);
      }
      data.dueDate = parsed;
    } else {
      return withIdNoStore(badRequest('dueDate invalide.'), requestId);
    }
  }

  if ('notes' in body) {
    const raw = (body as { notes?: unknown }).notes;
    if (raw === null || raw === undefined || raw === '') {
      data.notes = null;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.length > 2000) {
        return withIdNoStore(badRequest('notes trop longues.'), requestId);
      }
      data.notes = trimmed || null;
    } else {
      return withIdNoStore(badRequest('notes invalides.'), requestId);
    }
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  if ('status' in data) {
    const newStatus = data.status as TaskStatus;
    if (newStatus === TaskStatus.DONE) {
      data.completedAt = new Date();
      data.progress = 100;
    } else if (existing.status === TaskStatus.DONE) {
      data.completedAt = null;
    }
  }

  const updated = await prisma.task.update({
    where: { id: taskIdBigInt },
    data,
    include: {
      project: { select: { name: true } },
      assignee: { select: { id: true, email: true, name: true } },
    },
  });

  return withIdNoStore(jsonNoStore({ item: serializeTask(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/tasks/{taskId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; taskId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, taskId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const taskIdBigInt = parseId(taskId);
  if (!businessIdBigInt || !taskIdBigInt) {
    return withIdNoStore(badRequest('businessId ou taskId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureTaskDelegate(requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const task = await prisma.task.findFirst({
    where: { id: taskIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!task) return withIdNoStore(notFound('Tâche introuvable.'), requestId);

  await prisma.task.delete({ where: { id: taskIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
