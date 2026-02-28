import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, readJson } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { applyServiceProcessTemplateToProjectService } from '@/server/services/process/applyServiceProcessTemplate';
import { applyServiceTaskTemplatesToProjectService } from '@/server/services/process/applyServiceTaskTemplates';

// POST /api/pro/businesses/{businessId}/projects/{projectId}/services/{itemId}/tasks
export const POST = withBusinessRoute<{ businessId: string; projectId: string; itemId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:project-services:tasks:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const projectId = parseId(params.projectId);
    const itemId = parseId(params.itemId);

    const body = await readJson(req) as Record<string, unknown> | null;
    const taskAssigneeRaw = body?.taskAssigneeUserId;
    let taskAssigneeUserId: bigint | null = null;
    if (taskAssigneeRaw !== undefined && taskAssigneeRaw !== null && taskAssigneeRaw !== '') {
      if (typeof taskAssigneeRaw !== 'string' || !/^\d+$/.test(taskAssigneeRaw)) {
        return badRequest('taskAssigneeUserId invalide.');
      }
      const assigneeId = BigInt(taskAssigneeRaw);
      const membershipAssignee = await prisma.businessMembership.findUnique({
        where: { businessId_userId: { businessId: ctx.businessId, userId: assigneeId } },
      });
      if (!membershipAssignee) {
        return badRequest('taskAssigneeUserId doit être membre du business.');
      }
      taskAssigneeUserId = assigneeId;
    }

    const dueOffsetRaw = body?.taskDueOffsetDays;
    let taskDueOffsetDays: number | null = null;
    if (dueOffsetRaw !== undefined) {
      if (dueOffsetRaw === null) {
        taskDueOffsetDays = null;
      } else if (typeof dueOffsetRaw === 'number' && Number.isFinite(dueOffsetRaw)) {
        taskDueOffsetDays = Math.trunc(dueOffsetRaw);
        if (taskDueOffsetDays < 0 || taskDueOffsetDays > 365) {
          return badRequest('taskDueOffsetDays invalide (0-365).');
        }
      } else {
        return badRequest('taskDueOffsetDays invalide.');
      }
    }

    const generated = await applyServiceProcessTemplateToProjectService({
      businessId: ctx.businessId,
      projectId,
      projectServiceId: itemId,
      assigneeUserId: taskAssigneeUserId ?? undefined,
      dueOffsetDaysOverride: taskDueOffsetDays ?? undefined,
    });

    let generatedTasksCount = generated.createdTasksCount;
    let generatedStepsCount = generated.createdStepsCount;
    if (!generated.templateFound) {
      const fallback = await applyServiceTaskTemplatesToProjectService({
        businessId: ctx.businessId,
        projectId,
        projectServiceId: itemId,
        assigneeUserId: taskAssigneeUserId ?? undefined,
        dueOffsetDaysOverride: taskDueOffsetDays ?? undefined,
      });
      generatedTasksCount = fallback.createdTasksCount;
      generatedStepsCount = 0;
    }

    return jsonb({ generatedStepsCount, generatedTasksCount }, ctx.requestId);
  }
);
