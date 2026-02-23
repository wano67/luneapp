import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
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

function serializeItem(item: {
  id: bigint;
  title: string;
  position: number;
  isCompleted: boolean;
  completedAt: Date | null;
  completedBy: { id: bigint; name: string | null; email: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: item.id.toString(),
    title: item.title,
    position: item.position,
    isCompleted: item.isCompleted,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    completedBy: item.completedBy
      ? {
          id: item.completedBy.id.toString(),
          name: item.completedBy.name,
          email: item.completedBy.email,
        }
      : null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// PATCH /api/pro/businesses/{businessId}/tasks/{taskId}/checklist/{itemId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; taskId: string; itemId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, taskId, itemId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const taskIdBigInt = parseId(taskId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !taskIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Paramètres invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:tasks:checklist:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const task = await prisma.task.findFirst({
    where: { id: taskIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!task) return withIdNoStore(notFound('Tâche introuvable.'), requestId);

  const existing = await prisma.taskChecklistItem.findFirst({
    where: { id: itemIdBigInt, taskId: taskIdBigInt },
    include: { completedBy: { select: { id: true, name: true, email: true } } },
  });
  if (!existing) return withIdNoStore(notFound('Item introuvable.'), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const data: Record<string, unknown> = {};

  if ('title' in body) {
    const raw = (body as { title?: unknown }).title;
    if (raw === null || raw === undefined || raw === '') {
      data.title = null;
    } else if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return withIdNoStore(badRequest('title ne peut pas être vide.'), requestId);
      if (trimmed.length > 200) return withIdNoStore(badRequest('title trop long (200 max).'), requestId);
      data.title = trimmed;
    } else {
      return withIdNoStore(badRequest('title invalide.'), requestId);
    }
  }

  if ('position' in body) {
    const raw = (body as { position?: unknown }).position;
    if (raw === null || raw === undefined) {
      // ignore
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      data.position = Math.max(0, Math.trunc(raw));
    } else {
      return withIdNoStore(badRequest('position invalide.'), requestId);
    }
  }

  if ('isCompleted' in body) {
    const raw = (body as { isCompleted?: unknown }).isCompleted;
    if (typeof raw !== 'boolean') {
      return withIdNoStore(badRequest('isCompleted invalide.'), requestId);
    }
    data.isCompleted = raw;
    if (raw) {
      data.completedAt = new Date();
      data.completedByUserId = BigInt(userId);
    } else {
      data.completedAt = null;
      data.completedByUserId = null;
    }
  }

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.taskChecklistItem.update({
    where: { id: itemIdBigInt },
    data,
    include: { completedBy: { select: { id: true, name: true, email: true } } },
  });

  return withIdNoStore(
    jsonNoStore({ item: serializeItem(updated) }),
    requestId
  );
}

// DELETE /api/pro/businesses/{businessId}/tasks/{taskId}/checklist/{itemId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; taskId: string; itemId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, taskId, itemId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const taskIdBigInt = parseId(taskId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !taskIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Paramètres invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:tasks:checklist:delete:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const task = await prisma.task.findFirst({
    where: { id: taskIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!task) return withIdNoStore(notFound('Tâche introuvable.'), requestId);

  const existing = await prisma.taskChecklistItem.findFirst({
    where: { id: itemIdBigInt, taskId: taskIdBigInt },
    select: { id: true },
  });
  if (!existing) return withIdNoStore(notFound('Item introuvable.'), requestId);

  await prisma.taskChecklistItem.delete({ where: { id: itemIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
