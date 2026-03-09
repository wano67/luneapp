import { prisma } from '@/server/db/client';
import { CalendarEventKind } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { dayKey } from '@/lib/date';
import { projectRecurring, type CalendarEvent } from '@/lib/calendar';

const INTERACTION_LABELS: Record<string, string> = {
  CALL: 'Appel',
  MEETING: 'Réunion',
  EMAIL: 'Email',
  NOTE: 'Note',
  MESSAGE: 'Message',
};

const KIND_LABELS: Record<string, string> = {
  APPOINTMENT: 'RDV',
  REMINDER: 'Rappel',
};

// GET /api/pro/businesses/{businessId}/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
export const GET = withBusinessRoute(
  { minRole: 'VIEWER' },
  async (ctx, req) => {
    const url = req.nextUrl;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    if (!fromStr || !toStr) return badRequest('Paramètres from et to requis (YYYY-MM-DD).');

    const from = new Date(fromStr + 'T00:00:00Z');
    const to = new Date(toStr + 'T23:59:59Z');
    if (isNaN(from.getTime()) || isNaN(to.getTime())) return badRequest('Dates invalides.');

    const [tasks, interactions, recurringRules, calendarEvents] = await Promise.all([
      // 1. Tasks with dueDate in range (exclude DONE)
      prisma.task.findMany({
        where: {
          businessId: ctx.businessId,
          dueDate: { gte: from, lte: to },
          status: { not: 'DONE' },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true } },
        },
      }),

      // 2. Interactions (meetings, calls, follow-ups) in range
      prisma.interaction.findMany({
        where: {
          businessId: ctx.businessId,
          OR: [
            { happenedAt: { gte: from, lte: to } },
            { nextActionDate: { gte: from, lte: to } },
          ],
        },
        select: {
          id: true,
          type: true,
          content: true,
          happenedAt: true,
          nextActionDate: true,
          client: { select: { id: true, name: true } },
        },
      }),

      // 3. Active recurring finance rules
      prisma.financeRecurringRule.findMany({
        where: {
          businessId: ctx.businessId,
          isActive: true,
          startDate: { lte: to },
          OR: [{ endDate: null }, { endDate: { gte: from } }],
        },
        select: {
          id: true,
          dayOfMonth: true,
          amountCents: true,
          category: true,
          vendor: true,
          type: true,
          frequency: true,
          startDate: true,
          endDate: true,
        },
      }),

      // 4. Calendar events (appointments, reminders)
      prisma.calendarEvent.findMany({
        where: {
          businessId: ctx.businessId,
          startAt: { gte: from, lte: to },
        },
        select: {
          id: true,
          kind: true,
          title: true,
          description: true,
          startAt: true,
          endAt: true,
          allDay: true,
          location: true,
          clientId: true,
          projectId: true,
          client: { select: { name: true } },
          project: { select: { name: true } },
        },
      }),
    ]);

    const events: CalendarEvent[] = [];

    // Tasks → events
    for (const t of tasks) {
      if (!t.dueDate) continue;
      events.push({
        id: `task-${t.id}`,
        date: dayKey(t.dueDate),
        title: t.title,
        type: 'task',
        meta: {
          status: t.status,
          projectName: t.project?.name ?? null,
          projectId: t.project?.id?.toString() ?? null,
          assigneeName: t.assignee?.name ?? null,
        },
      });
    }

    // Interactions → events
    for (const i of interactions) {
      const label = INTERACTION_LABELS[i.type] ?? i.type;
      const preview = i.content.length > 50 ? i.content.slice(0, 50) + '…' : i.content;

      // Show nextActionDate as follow-up
      if (i.nextActionDate && i.nextActionDate >= from && i.nextActionDate <= to) {
        events.push({
          id: `interaction-next-${i.id}`,
          date: dayKey(i.nextActionDate),
          title: `Suivi: ${preview}`,
          type: 'interaction',
          meta: { interactionType: label, clientName: i.client?.name ?? null },
        });
      }
      // Show happenedAt for meetings & calls
      if ((i.type === 'MEETING' || i.type === 'CALL') && i.happenedAt >= from && i.happenedAt <= to) {
        events.push({
          id: `interaction-${i.id}`,
          date: dayKey(i.happenedAt),
          title: `${label}: ${preview}`,
          type: 'interaction',
          meta: { interactionType: label, clientName: i.client?.name ?? null },
        });
      }
    }

    // Recurring rules → project into date range
    for (const rule of recurringRules) {
      const projected = projectRecurring({
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        dayOfMonth: rule.dayOfMonth,
        rangeFrom: from,
        rangeTo: to,
      });
      const title = rule.vendor
        ? `${rule.category} — ${rule.vendor}`
        : rule.category;
      for (const d of projected) {
        events.push({
          id: `finance-${rule.id}-${dayKey(d)}`,
          date: dayKey(d),
          title,
          type: 'finance',
          meta: {
            amountCents: rule.amountCents.toString(),
            category: rule.category,
            vendor: rule.vendor,
            financeType: rule.type,
          },
        });
      }
    }

    // Calendar events (appointments, reminders) → events
    for (const ce of calendarEvents) {
      const startTime = ce.allDay ? null : ce.startAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const endTime = ce.allDay || !ce.endAt ? null : ce.endAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      events.push({
        id: `event-${ce.id}`,
        date: dayKey(ce.startAt),
        title: ce.title,
        type: 'event',
        meta: {
          eventId: ce.id.toString(),
          kind: ce.kind,
          kindLabel: KIND_LABELS[ce.kind] ?? ce.kind,
          description: ce.description,
          startAt: ce.startAt.toISOString(),
          endAt: ce.endAt?.toISOString() ?? null,
          startTime,
          endTime,
          allDay: ce.allDay,
          location: ce.location,
          clientName: ce.client?.name ?? null,
          projectName: ce.project?.name ?? null,
          clientId: ce.clientId?.toString() ?? null,
          projectId: ce.projectId?.toString() ?? null,
        },
      });
    }

    return jsonb({ items: events }, ctx.requestId);
  },
);

// POST /api/pro/businesses/{businessId}/calendar/events
export const POST = withBusinessRoute(
  { minRole: 'MEMBER' },
  async (ctx, req) => {
    const body = await req.json();
    const { kind, title, description, startAt, endAt, allDay, location, clientId, projectId, remindAt } = body as Record<string, unknown>;

    if (!kind || (kind !== 'APPOINTMENT' && kind !== 'REMINDER')) {
      return badRequest('kind requis (APPOINTMENT ou REMINDER).');
    }
    if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
      return badRequest('title requis (1-200 caractères).');
    }
    if (!startAt || typeof startAt !== 'string') {
      return badRequest('startAt requis (ISO 8601).');
    }
    const parsedStart = new Date(startAt as string);
    if (isNaN(parsedStart.getTime())) return badRequest('startAt invalide.');

    let parsedEnd: Date | undefined;
    if (endAt && typeof endAt === 'string') {
      parsedEnd = new Date(endAt as string);
      if (isNaN(parsedEnd.getTime())) return badRequest('endAt invalide.');
    }

    let parsedRemind: Date | undefined;
    if (remindAt && typeof remindAt === 'string') {
      parsedRemind = new Date(remindAt as string);
      if (isNaN(parsedRemind.getTime())) return badRequest('remindAt invalide.');
    }

    let parsedClientId: bigint | undefined;
    if (clientId && typeof clientId === 'string' && /^\d+$/.test(clientId)) {
      parsedClientId = BigInt(clientId);
    }

    let parsedProjectId: bigint | undefined;
    if (projectId && typeof projectId === 'string' && /^\d+$/.test(projectId)) {
      parsedProjectId = BigInt(projectId);
    }

    const event = await prisma.calendarEvent.create({
      data: {
        businessId: ctx.businessId,
        userId: ctx.userId,
        kind: kind as CalendarEventKind,
        title: (title as string).trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        startAt: parsedStart,
        endAt: parsedEnd,
        allDay: allDay === true,
        location: typeof location === 'string' ? location.trim() || null : null,
        clientId: parsedClientId,
        projectId: parsedProjectId,
        remindAt: parsedRemind,
      },
    });

    return jsonbCreated({
      item: {
        id: event.id.toString(),
        kind: event.kind,
        title: event.title,
        description: event.description,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt?.toISOString() ?? null,
        allDay: event.allDay,
        location: event.location,
        clientId: event.clientId?.toString() ?? null,
        projectId: event.projectId?.toString() ?? null,
        remindAt: event.remindAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
      },
    }, ctx.requestId);
  },
);
