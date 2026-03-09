import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
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

    const [tasks, interactions, recurringRules] = await Promise.all([
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

    return jsonb({ items: events }, ctx.requestId);
  },
);
