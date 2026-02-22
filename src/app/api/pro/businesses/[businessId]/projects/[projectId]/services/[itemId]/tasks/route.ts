import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { badRequest, getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { applyServiceProcessTemplateToProjectService } from '@/server/services/process/applyServiceProcessTemplate';
import { applyServiceTaskTemplatesToProjectService } from '@/server/services/process/applyServiceTaskTemplates';

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

// POST /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}/tasks
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string; itemId: string }> }
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

  const { businessId, projectId, itemId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  const itemIdBigInt = parseId(itemId);
  if (!businessIdBigInt || !projectIdBigInt || !itemIdBigInt) {
    return withIdNoStore(badRequest('Ids invalides.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return forbidden(requestId);

  const limited = rateLimit(request, {
    key: `pro:project-services:tasks:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  const taskAssigneeRaw = (body as { taskAssigneeUserId?: unknown })?.taskAssigneeUserId;
  let taskAssigneeUserId: bigint | null = null;
  if (taskAssigneeRaw !== undefined && taskAssigneeRaw !== null && taskAssigneeRaw !== '') {
    if (typeof taskAssigneeRaw !== 'string' || !/^\d+$/.test(taskAssigneeRaw)) {
      return withIdNoStore(badRequest('taskAssigneeUserId invalide.'), requestId);
    }
    const assigneeId = BigInt(taskAssigneeRaw);
    const membershipAssignee = await prisma.businessMembership.findUnique({
      where: { businessId_userId: { businessId: businessIdBigInt, userId: assigneeId } },
    });
    if (!membershipAssignee) {
      return withIdNoStore(badRequest('taskAssigneeUserId doit être membre du business.'), requestId);
    }
    taskAssigneeUserId = assigneeId;
  }

  const dueOffsetRaw = (body as { taskDueOffsetDays?: unknown })?.taskDueOffsetDays;
  let taskDueOffsetDays: number | null = null;
  if (dueOffsetRaw !== undefined) {
    if (dueOffsetRaw === null) {
      taskDueOffsetDays = null;
    } else if (typeof dueOffsetRaw === 'number' && Number.isFinite(dueOffsetRaw)) {
      taskDueOffsetDays = Math.trunc(dueOffsetRaw);
      if (taskDueOffsetDays < 0 || taskDueOffsetDays > 365) {
        return withIdNoStore(badRequest('taskDueOffsetDays invalide (0-365).'), requestId);
      }
    } else {
      return withIdNoStore(badRequest('taskDueOffsetDays invalide.'), requestId);
    }
  }

  const generated = await applyServiceProcessTemplateToProjectService({
    businessId: businessIdBigInt,
    projectId: projectIdBigInt,
    projectServiceId: itemIdBigInt,
    assigneeUserId: taskAssigneeUserId ?? undefined,
    dueOffsetDaysOverride: taskDueOffsetDays ?? undefined,
  });

  let generatedTasksCount = generated.createdTasksCount;
  let generatedStepsCount = generated.createdStepsCount;
  if (!generated.templateFound) {
    const fallback = await applyServiceTaskTemplatesToProjectService({
      businessId: businessIdBigInt,
      projectId: projectIdBigInt,
      projectServiceId: itemIdBigInt,
      assigneeUserId: taskAssigneeUserId ?? undefined,
      dueOffsetDaysOverride: taskDueOffsetDays ?? undefined,
    });
    generatedTasksCount = fallback.createdTasksCount;
    generatedStepsCount = 0;
  }

  return withIdNoStore(
    jsonNoStore({
      generatedStepsCount,
      generatedTasksCount,
    }),
    requestId
  );
}
