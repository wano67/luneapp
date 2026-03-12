import { prisma } from '@/server/db/client';
import type { AutomationTrigger, AutomationAction, ProjectStatus } from '@/generated/prisma';
import { notify } from './notifications';

// ---------------------------------------------------------------------------
// Context types passed to the engine
// ---------------------------------------------------------------------------

type AutomationContext = {
  businessId: bigint;
  actorUserId: bigint;
  projectId?: bigint | null;
  taskId?: bigint | null;
  taskTitle?: string;
  taskStatus?: string;
  invoiceLabel?: string;
  projectName?: string;
  projectStatus?: string;
};

// ---------------------------------------------------------------------------
// Execute all matching automations — fire-and-forget safe
// ---------------------------------------------------------------------------

export async function executeAutomations(
  trigger: AutomationTrigger,
  ctx: AutomationContext,
) {
  try {
    const automations = await prisma.automation.findMany({
      where: {
        businessId: ctx.businessId,
        trigger,
        enabled: true,
        OR: [
          { projectId: null },
          ...(ctx.projectId ? [{ projectId: ctx.projectId }] : []),
        ],
      },
    });

    for (const auto of automations) {
      try {
        await executeAction(auto.action, auto.config as Record<string, unknown>, ctx);
      } catch {
        // Silently ignore individual automation failures
      }
    }
  } catch {
    // Fire-and-forget — never throw
  }
}

// ---------------------------------------------------------------------------
// Action executors
// ---------------------------------------------------------------------------

async function executeAction(
  action: AutomationAction,
  config: Record<string, unknown>,
  ctx: AutomationContext,
) {
  switch (action) {
    case 'NOTIFY_TEAM':
      return actionNotifyTeam(ctx);

    case 'NOTIFY_CLIENT':
      return actionNotifyClient(ctx);

    case 'CREATE_TASK':
      return actionCreateTask(config, ctx);

    case 'CHANGE_PROJECT_STATUS':
      return actionChangeProjectStatus(config, ctx);
  }
}

/** Notify all business members about the event. */
async function actionNotifyTeam(ctx: AutomationContext) {
  const members = await prisma.businessMembership.findMany({
    where: { businessId: ctx.businessId },
    select: { userId: true },
  });
  const title = buildNotificationTitle(ctx);
  await notify(members.map((m) => m.userId), ctx.actorUserId, {
    businessId: ctx.businessId,
    type: 'TASK_STATUS_CHANGED',
    title,
    taskId: ctx.taskId ?? null,
    projectId: ctx.projectId ?? null,
  });
}

/** Notify the project's client contact (via team members as proxy). */
async function actionNotifyClient(ctx: AutomationContext) {
  if (!ctx.projectId) return;

  // Find the project's client and notify project members
  const project = await prisma.project.findUnique({
    where: { id: ctx.projectId },
    select: {
      clientId: true,
      client: { select: { name: true } },
      projectMembers: {
        select: { membership: { select: { userId: true } } },
      },
    },
  });
  if (!project?.clientId) return;

  const title = `Client ${project.client?.name ?? ''} — ${buildNotificationTitle(ctx)}`;
  const memberUserIds = project.projectMembers.map((pm) => pm.membership.userId);

  await notify(memberUserIds, ctx.actorUserId, {
    businessId: ctx.businessId,
    type: 'TASK_STATUS_CHANGED',
    title,
    taskId: ctx.taskId ?? null,
    projectId: ctx.projectId ?? null,
    clientId: project.clientId,
  });
}

/** Create a follow-up task automatically. */
async function actionCreateTask(config: Record<string, unknown>, ctx: AutomationContext) {
  const titleTemplate = (config.taskTitle as string) || 'Suite : {taskTitle}';
  const title = titleTemplate.replace('{taskTitle}', ctx.taskTitle ?? 'Tâche');

  await prisma.task.create({
    data: {
      businessId: ctx.businessId,
      projectId: ctx.projectId ?? null,
      title,
      status: 'TODO',
    },
  });
}

/** Change project status when triggered (e.g., all tasks done → project completed). */
async function actionChangeProjectStatus(config: Record<string, unknown>, ctx: AutomationContext) {
  if (!ctx.projectId) return;
  const newStatus = config.newStatus as string | undefined;
  if (!newStatus) return;

  // Validate the status is a valid ProjectStatus
  const validStatuses = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const;
  if (!validStatuses.includes(newStatus as typeof validStatuses[number])) return;

  // For TASK_COMPLETED trigger: only change status if ALL tasks in project are DONE
  if (ctx.taskId) {
    const pendingCount = await prisma.task.count({
      where: {
        projectId: ctx.projectId,
        businessId: ctx.businessId,
        status: { not: 'DONE' },
      },
    });
    if (pendingCount > 0) return;
  }

  await prisma.project.update({
    where: { id: ctx.projectId },
    data: { status: newStatus as ProjectStatus },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildNotificationTitle(ctx: AutomationContext): string {
  if (ctx.taskTitle && ctx.taskStatus) {
    return `Tâche "${ctx.taskTitle}" → ${ctx.taskStatus}`;
  }
  if (ctx.taskTitle) {
    return `Tâche "${ctx.taskTitle}" terminée`;
  }
  if (ctx.invoiceLabel) {
    return `Facture créée : ${ctx.invoiceLabel}`;
  }
  if (ctx.projectName && ctx.projectStatus) {
    return `Projet "${ctx.projectName}" → ${ctx.projectStatus}`;
  }
  return 'Automation déclenchée';
}
