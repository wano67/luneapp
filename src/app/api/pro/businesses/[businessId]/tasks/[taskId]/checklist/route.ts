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

// GET /api/pro/businesses/{businessId}/tasks/{taskId}/checklist
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

  const businessIdBigInt = parseId(businessId);
  const taskIdBigInt = parseId(taskId);
  if (!businessIdBigInt || !taskIdBigInt) {
    return withIdNoStore(badRequest('businessId ou taskId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const task = await prisma.task.findFirst({
    where: { id: taskIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!task) return withIdNoStore(notFound('Tâche introuvable.'), requestId);

  const items = await prisma.taskChecklistItem.findMany({
    where: { taskId: taskIdBigInt },
    include: { completedBy: { select: { id: true, name: true, email: true } } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  return withIdNoStore(
    jsonNoStore({ items: items.map(serializeItem) }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/tasks/{taskId}/checklist
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; taskId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, taskId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const taskIdBigInt = parseId(taskId);
  if (!businessIdBigInt || !taskIdBigInt) {
    return withIdNoStore(badRequest('businessId ou taskId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:tasks:checklist:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const task = await prisma.task.findFirst({
    where: { id: taskIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!task) return withIdNoStore(notFound('Tâche introuvable.'), requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const titleRaw = (body as { title?: unknown }).title;
  if (typeof titleRaw !== 'string') {
    return withIdNoStore(badRequest('title requis.'), requestId);
  }
  const title = titleRaw.trim();
  if (!title) return withIdNoStore(badRequest('title ne peut pas être vide.'), requestId);
  if (title.length > 200) return withIdNoStore(badRequest('title trop long (200 max).'), requestId);

  let position: number | undefined;
  if ('position' in body && (body as { position?: unknown }).position !== undefined) {
    const raw = (body as { position?: unknown }).position;
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return withIdNoStore(badRequest('position invalide.'), requestId);
    }
    position = Math.max(0, Math.trunc(raw));
  }

  if (position === undefined) {
    const last = await prisma.taskChecklistItem.findFirst({
      where: { taskId: taskIdBigInt },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = last ? last.position + 1 : 0;
  }

  const created = await prisma.taskChecklistItem.create({
    data: {
      taskId: taskIdBigInt,
      title,
      position,
    },
    include: { completedBy: { select: { id: true, name: true, email: true } } },
  });

  return withIdNoStore(
    jsonNoStore({ item: serializeItem(created) }, { status: 201 }),
    requestId
  );
}
