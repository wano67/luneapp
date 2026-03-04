import { prisma } from '@/server/db/client';
import type { NotificationType } from '@/generated/prisma';

type NotifyParams = {
  businessId: bigint;
  type: NotificationType;
  title: string;
  body?: string | null;
  taskId?: bigint | null;
  projectId?: bigint | null;
};

/**
 * Create notifications for a list of users (excluding the actor).
 * Fire-and-forget safe — never throws.
 */
export async function notify(
  userIds: bigint[],
  actorUserId: bigint,
  params: NotifyParams,
) {
  const recipients = userIds.filter((id) => id !== actorUserId);
  if (recipients.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        businessId: params.businessId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        taskId: params.taskId ?? null,
        projectId: params.projectId ?? null,
      })),
    });
  } catch {
    // Fire-and-forget — log silently in dev
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[notifications] failed to create notifications');
    }
  }
}

/** Notify when task is assigned to specific users. */
export async function notifyTaskAssigned(
  assignedUserIds: bigint[],
  actorUserId: bigint,
  businessId: bigint,
  taskTitle: string,
  taskId: bigint,
  projectId: bigint | null,
) {
  await notify(assignedUserIds, actorUserId, {
    businessId,
    type: 'TASK_ASSIGNED',
    title: `Tâche assignée : ${taskTitle}`,
    taskId,
    projectId,
  });
}

/** Notify all members of a pôle when a task is assigned to it. */
export async function notifyPoleAssigned(
  organizationUnitId: bigint,
  actorUserId: bigint,
  businessId: bigint,
  taskTitle: string,
  taskId: bigint,
  projectId: bigint | null,
) {
  const members = await prisma.businessMembership.findMany({
    where: { businessId, organizationUnitId },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'TASK_ASSIGNED',
    title: `Nouvelle tâche pour votre pôle : ${taskTitle}`,
    taskId,
    projectId,
  });
}

/** Notify task assignees on status change. */
export async function notifyTaskStatusChanged(
  taskId: bigint,
  actorUserId: bigint,
  businessId: bigint,
  taskTitle: string,
  newStatus: string,
  projectId: bigint | null,
) {
  // Gather all people linked to this task
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      assigneeUserId: true,
      organizationUnitId: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task) return;

  const userIds = new Set<bigint>();
  if (task.assigneeUserId) userIds.add(task.assigneeUserId);
  for (const a of task.assignees) userIds.add(a.userId);

  // If assigned to a pôle, include pôle members
  if (task.organizationUnitId) {
    const members = await prisma.businessMembership.findMany({
      where: { businessId, organizationUnitId: task.organizationUnitId },
      select: { userId: true },
    });
    for (const m of members) userIds.add(m.userId);
  }

  const statusLabels: Record<string, string> = {
    TODO: 'À faire',
    IN_PROGRESS: 'En cours',
    DONE: 'Terminée',
  };

  await notify(Array.from(userIds), actorUserId, {
    businessId,
    type: 'TASK_STATUS_CHANGED',
    title: `${taskTitle} → ${statusLabels[newStatus] ?? newStatus}`,
    taskId,
    projectId,
  });
}

/** Notify task assignees when task is blocked. */
export async function notifyTaskBlocked(
  taskId: bigint,
  actorUserId: bigint,
  businessId: bigint,
  taskTitle: string,
  blockedReason: string | null,
  projectId: bigint | null,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      assigneeUserId: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!task) return;

  const userIds = new Set<bigint>();
  if (task.assigneeUserId) userIds.add(task.assigneeUserId);
  for (const a of task.assignees) userIds.add(a.userId);

  await notify(Array.from(userIds), actorUserId, {
    businessId,
    type: 'TASK_BLOCKED',
    title: `Tâche bloquée : ${taskTitle}`,
    body: blockedReason,
    taskId,
    projectId,
  });
}
