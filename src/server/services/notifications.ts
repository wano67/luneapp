import { prisma } from '@/server/db/client';
import type { NotificationType } from '@/generated/prisma';
import { formatTaskStatus } from '@/lib/taskStatusUi';

type NotifyParams = {
  businessId: bigint;
  type: NotificationType;
  title: string;
  body?: string | null;
  taskId?: bigint | null;
  projectId?: bigint | null;
  conversationId?: bigint | null;
  clientId?: bigint | null;
  prospectId?: bigint | null;
  calendarEventId?: bigint | null;
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
    // Filter out users who disabled this notification type
    const disabledPrefs = await prisma.notificationPreference.findMany({
      where: {
        userId: { in: recipients },
        businessId: params.businessId,
        type: params.type,
        enabled: false,
      },
      select: { userId: true },
    });
    const disabledSet = new Set(disabledPrefs.map((p) => p.userId));
    const finalRecipients = recipients.filter((id) => !disabledSet.has(id));
    if (finalRecipients.length === 0) return;

    await prisma.notification.createMany({
      data: finalRecipients.map((userId) => ({
        userId,
        businessId: params.businessId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        taskId: params.taskId ?? null,
        projectId: params.projectId ?? null,
        conversationId: params.conversationId ?? null,
        clientId: params.clientId ?? null,
        prospectId: params.prospectId ?? null,
        calendarEventId: params.calendarEventId ?? null,
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

  await notify(Array.from(userIds), actorUserId, {
    businessId,
    type: 'TASK_STATUS_CHANGED',
    title: `${taskTitle} → ${formatTaskStatus(newStatus)}`,
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

/** Notify conversation members when a new message is sent. */
export async function notifyMessageReceived(
  conversationId: bigint,
  actorUserId: bigint,
  businessId: bigint,
  senderName: string,
  messagePreview: string | null,
  projectId: bigint | null,
) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);

  const body = messagePreview
    ? messagePreview.length > 100
      ? messagePreview.slice(0, 100) + '…'
      : messagePreview
    : null;

  await notify(userIds, actorUserId, {
    businessId,
    type: 'MESSAGE_RECEIVED',
    title: `Nouveau message de ${senderName}`,
    body,
    conversationId,
    projectId,
  });
}

/** Notify project members when a project is past its endDate. */
export async function notifyProjectOverdue(
  projectId: bigint,
  businessId: bigint,
  projectName: string,
) {
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { membership: { select: { userId: true } } },
  });
  const userIds = projectMembers.map((pm) => pm.membership.userId);
  if (userIds.length === 0) return;

  const SYSTEM_USER = 0n;
  await notify(userIds, SYSTEM_USER, {
    businessId,
    type: 'PROJECT_OVERDUE',
    title: `Projet en retard : ${projectName}`,
    body: 'La date de fin prévue est dépassée.',
    projectId,
  });
}

/** Notify task assignees when a task is due within 24 hours. */
export async function notifyTaskDueSoon(
  taskId: bigint,
  businessId: bigint,
  taskTitle: string,
  projectId: bigint | null,
) {
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

  if (task.organizationUnitId) {
    const members = await prisma.businessMembership.findMany({
      where: { businessId, organizationUnitId: task.organizationUnitId },
      select: { userId: true },
    });
    for (const m of members) userIds.add(m.userId);
  }

  const SYSTEM_USER = 0n;
  await notify(Array.from(userIds), SYSTEM_USER, {
    businessId,
    type: 'TASK_DUE_SOON',
    title: `Tâche bientôt due : ${taskTitle}`,
    body: 'Échéance dans moins de 24 heures.',
    taskId,
    projectId,
  });
}

/** Notify the event owner before a calendar event starts. */
export async function notifyCalendarReminder(
  calendarEventId: bigint,
  businessId: bigint,
  userId: bigint,
  eventTitle: string,
  startAt: Date,
) {
  const SYSTEM_USER = 0n;
  const minutesUntil = Math.round((startAt.getTime() - Date.now()) / 60_000);
  const body = minutesUntil <= 60
    ? `Dans ${minutesUntil} min`
    : `Aujourd'hui a ${startAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

  await notify([userId], SYSTEM_USER, {
    businessId,
    type: 'CALENDAR_REMINDER',
    title: `Rappel : ${eventTitle}`,
    body,
    calendarEventId,
  });
}

/** Notify task assignees when a task is past its dueDate. */
export async function notifyTaskOverdue(
  taskId: bigint,
  businessId: bigint,
  taskTitle: string,
  projectId: bigint | null,
) {
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

  if (task.organizationUnitId) {
    const members = await prisma.businessMembership.findMany({
      where: { businessId, organizationUnitId: task.organizationUnitId },
      select: { userId: true },
    });
    for (const m of members) userIds.add(m.userId);
  }

  const SYSTEM_USER = 0n;
  await notify(Array.from(userIds), SYSTEM_USER, {
    businessId,
    type: 'TASK_OVERDUE',
    title: `Tâche en retard : ${taskTitle}`,
    body: 'La date d\'échéance est dépassée.',
    taskId,
    projectId,
  });
}

/** Notify business members when an active client has had no interaction for X days. */
export async function notifyClientFollowup(
  clientId: bigint,
  businessId: bigint,
  clientName: string,
  daysSinceLastContact: number,
) {
  const members = await prisma.businessMembership.findMany({
    where: { businessId },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return;

  const SYSTEM_USER = 0n;
  await notify(userIds, SYSTEM_USER, {
    businessId,
    type: 'CLIENT_FOLLOWUP',
    title: `Relance client : ${clientName}`,
    body: `Aucune interaction depuis ${daysSinceLastContact} jours.`,
    clientId,
  });
}

/** Notify business members when a prospect has not been followed up in 24h. */
export async function notifyProspectFollowup(
  prospectId: bigint,
  businessId: bigint,
  prospectName: string,
) {
  const members = await prisma.businessMembership.findMany({
    where: { businessId },
    select: { userId: true },
  });
  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return;

  const SYSTEM_USER = 0n;
  await notify(userIds, SYSTEM_USER, {
    businessId,
    type: 'PROSPECT_FOLLOWUP',
    title: `Prospect à relancer : ${prospectName}`,
    body: 'Aucun suivi depuis plus de 24h.',
    prospectId,
  });
}

/** Notify business members when a new interaction is created. */
export async function notifyInteractionAdded(
  actorUserId: bigint,
  businessId: bigint,
  interactionType: string,
  clientId: bigint | null,
  prospectId: bigint | null,
  projectId: bigint | null,
) {
  const members = await prisma.businessMembership.findMany({
    where: { businessId },
    select: { userId: true },
  });
  const typeLabel: Record<string, string> = {
    CALL: 'Appel',
    MEETING: 'RDV',
    EMAIL: 'Email',
    NOTE: 'Note',
    MESSAGE: 'Message',
  };
  await notify(members.map((m) => m.userId), actorUserId, {
    businessId,
    type: 'INTERACTION_ADDED',
    title: `Nouvelle interaction : ${typeLabel[interactionType] ?? interactionType}`,
    clientId,
    prospectId,
    projectId,
  });
}

/** Notify project members when a document is uploaded. */
export async function notifyDocumentUploaded(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  documentTitle: string,
) {
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { membership: { select: { userId: true } } },
  });
  await notify(projectMembers.map((pm) => pm.membership.userId), actorUserId, {
    businessId,
    type: 'DOCUMENT_UPLOADED',
    title: `Document ajouté : ${documentTitle}`,
    projectId,
  });
}

/** Notify project members when an invoice is created. */
export async function notifyInvoiceCreated(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  invoiceLabel: string,
) {
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { membership: { select: { userId: true } } },
  });
  await notify(projectMembers.map((pm) => pm.membership.userId), actorUserId, {
    businessId,
    type: 'INVOICE_CREATED',
    title: `Nouvelle facture : ${invoiceLabel}`,
    projectId,
  });
}

/** Notify project members when a quote is created. */
export async function notifyQuoteCreated(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
) {
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    select: { membership: { select: { userId: true } } },
  });
  await notify(projectMembers.map((pm) => pm.membership.userId), actorUserId, {
    businessId,
    type: 'QUOTE_CREATED',
    title: 'Nouveau devis créé',
    projectId,
  });
}
