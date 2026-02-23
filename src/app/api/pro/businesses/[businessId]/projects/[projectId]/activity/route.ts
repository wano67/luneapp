import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';
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

// GET /api/pro/businesses/{businessId}/projects/{projectId}/activity
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, projectId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!project) return withIdNoStore(notFound('Projet introuvable.'), requestId);

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam && /^\d+$/.test(limitParam) ? Math.min(50, Math.max(1, Number(limitParam))) : 20;

  const rows = await prisma.task.findMany({
    where: { projectId: projectIdBigInt, businessId: businessIdBigInt, statusUpdatedAt: { not: null } },
    orderBy: { statusUpdatedAt: 'desc' },
    take: limit,
    include: {
      statusUpdatedByUser: { select: { id: true, name: true, email: true } },
      projectService: { select: { id: true, service: { select: { name: true } } } },
    },
  });

  return withIdNoStore(
    jsonNoStore({
      items: rows.map((task) => ({
        type: 'TASK_STATUS_UPDATED',
        taskId: task.id.toString(),
        title: task.title,
        status: task.status,
        serviceName: task.projectService?.service?.name ?? null,
        occurredAt: task.statusUpdatedAt ? task.statusUpdatedAt.toISOString() : null,
        actor: task.statusUpdatedByUser
          ? {
              id: task.statusUpdatedByUser.id.toString(),
              name: task.statusUpdatedByUser.name ?? null,
              email: task.statusUpdatedByUser.email ?? null,
            }
          : null,
      })),
    }),
    requestId
  );
}
