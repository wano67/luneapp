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
 * Create notifications for a list of users.
 * By default the actor is excluded; pass `includeSelf: true` to keep them.
 * Fire-and-forget safe — never throws.
 */
export async function notify(
  userIds: bigint[],
  actorUserId: bigint,
  params: NotifyParams & { includeSelf?: boolean },
) {
  const { includeSelf, ...notifParams } = params;
  const recipients = includeSelf ? [...userIds] : userIds.filter((id) => id !== actorUserId);
  const unique = [...new Set(recipients)];
  if (unique.length === 0) return;

  try {
    // Filter out users who disabled this notification type
    const disabledPrefs = await prisma.notificationPreference.findMany({
      where: {
        userId: { in: unique },
        businessId: notifParams.businessId,
        type: notifParams.type,
        enabled: false,
      },
      select: { userId: true },
    });
    const disabledSet = new Set(disabledPrefs.map((p) => p.userId));
    const finalRecipients = unique.filter((id) => !disabledSet.has(id));
    if (finalRecipients.length === 0) return;

    await prisma.notification.createMany({
      data: finalRecipients.map((userId) => ({
        userId,
        businessId: notifParams.businessId,
        type: notifParams.type,
        title: notifParams.title,
        body: notifParams.body ?? null,
        taskId: notifParams.taskId ?? null,
        projectId: notifParams.projectId ?? null,
        conversationId: notifParams.conversationId ?? null,
        clientId: notifParams.clientId ?? null,
        prospectId: notifParams.prospectId ?? null,
        calendarEventId: notifParams.calendarEventId ?? null,
      })),
    });
  } catch {
    // Fire-and-forget — log silently in dev
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[notifications] failed to create notifications');
    }
  }
}

/**
 * Collect all users that should be notified for a project event:
 * project members + business OWNER/ADMIN (who see everything).
 */
async function projectRecipients(businessId: bigint, projectId: bigint): Promise<bigint[]> {
  const [projectMembers, admins] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      select: { membership: { select: { userId: true } } },
    }),
    prisma.businessMembership.findMany({
      where: { businessId, role: { in: ['OWNER', 'ADMIN'] } },
      select: { userId: true },
    }),
  ]);
  const ids = new Set<bigint>();
  for (const pm of projectMembers) ids.add(pm.membership.userId);
  for (const a of admins) ids.add(a.userId);
  return [...ids];
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

/** Notify task assignees + admins on status change. */
export async function notifyTaskStatusChanged(
  taskId: bigint,
  actorUserId: bigint,
  businessId: bigint,
  taskTitle: string,
  newStatus: string,
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

  // Also include business admins/owners
  const admins = await prisma.businessMembership.findMany({
    where: { businessId, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });
  for (const a of admins) userIds.add(a.userId);

  await notify(Array.from(userIds), actorUserId, {
    businessId,
    type: 'TASK_STATUS_CHANGED',
    title: `${taskTitle} → ${formatTaskStatus(newStatus)}`,
    taskId,
    projectId,
    includeSelf: true,
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

/** Notify project members + admins when a project is past its endDate. */
export async function notifyProjectOverdue(
  projectId: bigint,
  businessId: bigint,
  projectName: string,
) {
  const userIds = await projectRecipients(businessId, projectId);
  if (userIds.length === 0) return;

  const SYSTEM_USER = 0n;
  await notify(userIds, SYSTEM_USER, {
    businessId,
    type: 'PROJECT_OVERDUE',
    title: `Projet en retard : ${projectName}`,
    body: 'La date de fin prévue est dépassée.',
    projectId,
    includeSelf: true,
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

/** Notify project members + admins when a document is uploaded. */
export async function notifyDocumentUploaded(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  documentTitle: string,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'DOCUMENT_UPLOADED',
    title: `Document ajouté : ${documentTitle}`,
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when an invoice is created. */
export async function notifyInvoiceCreated(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  invoiceLabel: string,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'INVOICE_CREATED',
    title: `Nouvelle facture : ${invoiceLabel}`,
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when a quote is created. */
export async function notifyQuoteCreated(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'QUOTE_CREATED',
    title: 'Nouveau devis créé',
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when a payment is received on an invoice. */
export async function notifyPaymentReceived(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  amountLabel: string,
  invoiceNumber: string | null,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'PAYMENT_RECEIVED',
    title: `Paiement reçu : ${amountLabel}`,
    body: invoiceNumber ? `Facture ${invoiceNumber}` : undefined,
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when a deposit is fully paid. */
export async function notifyDepositPaid(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'DEPOSIT_PAID',
    title: 'Acompte encaissé',
    body: 'Le dépôt a été intégralement réglé.',
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when a project is automatically activated. */
export async function notifyProjectActivated(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'PROJECT_ACTIVATED',
    title: 'Projet démarré',
    body: 'Le devis est signé et l\'acompte réglé — le projet passe en actif.',
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when a project is automatically completed. */
export async function notifyProjectCompleted(
  businessId: bigint,
  projectId: bigint,
) {
  const userIds = await projectRecipients(businessId, projectId);
  const SYSTEM_USER = 0n;
  await notify(userIds, SYSTEM_USER, {
    businessId,
    type: 'PROJECT_COMPLETED',
    title: 'Projet terminé',
    body: 'Toutes les factures sont soldées — le projet est marqué comme terminé.',
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when a quote is sent to client by email. */
export async function notifyQuoteSentToClient(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  quoteNumber: string | null,
  clientEmail: string,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'QUOTE_SENT_TO_CLIENT',
    title: `Devis envoyé${quoteNumber ? ` : ${quoteNumber}` : ''}`,
    body: `Envoyé par email à ${clientEmail}`,
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when an invoice is sent to client by email. */
export async function notifyInvoiceSentToClient(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  invoiceNumber: string | null,
  clientEmail: string,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'INVOICE_SENT_TO_CLIENT',
    title: `Facture envoyée${invoiceNumber ? ` : ${invoiceNumber}` : ''}`,
    body: `Envoyée par email à ${clientEmail}`,
    projectId,
    includeSelf: true,
  });
}

/** Notify project members + admins when a quote is signed/accepted. */
export async function notifyQuoteSigned(
  actorUserId: bigint,
  businessId: bigint,
  projectId: bigint,
  quoteNumber: string | null,
) {
  const userIds = await projectRecipients(businessId, projectId);
  await notify(userIds, actorUserId, {
    businessId,
    type: 'QUOTE_SIGNED',
    title: `Devis accepté${quoteNumber ? ` : ${quoteNumber}` : ''}`,
    projectId,
    includeSelf: true,
  });
}
