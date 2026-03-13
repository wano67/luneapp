import { prisma } from '@/server/db/client';
import { CalendarEventKind } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { projectRecurring, type CalendarEvent } from '@/lib/calendar';
import { tzDayKey, tzTimeStr, safeTz } from '@/lib/tz';

const KIND_LABELS: Record<string, string> = {
  APPOINTMENT: 'RDV',
  REMINDER: 'Rappel',
};

// GET /api/personal/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
export const GET = withPersonalRoute(async (ctx, req) => {
  const url = req.nextUrl;
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  if (!fromStr || !toStr) return badRequest('Paramètres from et to requis (YYYY-MM-DD).');
  const tz = safeTz(url.searchParams.get('tz'));

  // Widen range by ±1 day to handle timezone offsets (up to ±14h)
  const from = new Date(fromStr + 'T00:00:00Z');
  const to = new Date(toStr + 'T23:59:59Z');
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return badRequest('Dates invalides.');
  from.setUTCDate(from.getUTCDate() - 1);
  to.setUTCDate(to.getUTCDate() + 1);

  const [subscriptions, incomes, goals, calendarEvents] = await Promise.all([
    // 1. Active subscriptions
    prisma.personalSubscription.findMany({
      where: {
        userId: ctx.userId,
        isActive: true,
        startDate: { lte: to },
        OR: [{ endDate: null }, { endDate: { gte: from } }],
      },
      select: {
        id: true,
        name: true,
        amountCents: true,
        frequency: true,
        startDate: true,
        endDate: true,
        category: { select: { name: true } },
      },
    }),

    // 2. Income transactions in range
    prisma.personalTransaction.findMany({
      where: {
        userId: ctx.userId,
        type: 'INCOME',
        date: { gte: from, lte: to },
      },
      select: { id: true, label: true, date: true, amountCents: true },
    }),

    // 3. Savings goals with deadline in range
    prisma.savingsGoal.findMany({
      where: {
        userId: ctx.userId,
        deadline: { gte: from, lte: to },
        isCompleted: false,
      },
      select: { id: true, name: true, deadline: true, targetCents: true, currentCents: true },
    }),

    // 4. Personal calendar events (appointments, reminders)
    prisma.personalCalendarEvent.findMany({
      where: {
        userId: ctx.userId,
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
      },
    }),
  ]);

  const events: CalendarEvent[] = [];

  // Subscriptions → project recurring dates
  for (const sub of subscriptions) {
    const projected = projectRecurring({
      startDate: sub.startDate,
      endDate: sub.endDate,
      frequency: sub.frequency,
      rangeFrom: from,
      rangeTo: to,
    });
    for (const d of projected) {
      events.push({
        id: `sub-${sub.id}-${tzDayKey(d, tz)}`,
        date: tzDayKey(d, tz),
        title: sub.name,
        type: 'subscription',
        meta: {
          amountCents: sub.amountCents.toString(),
          categoryName: sub.category?.name ?? null,
        },
      });
    }
  }

  // Income → events
  for (const inc of incomes) {
    events.push({
      id: `income-${inc.id}`,
      date: tzDayKey(inc.date, tz),
      title: inc.label,
      type: 'finance',
      meta: { amountCents: inc.amountCents.toString() },
    });
  }

  // Savings goals → events
  for (const g of goals) {
    if (!g.deadline) continue;
    events.push({
      id: `savings-${g.id}`,
      date: tzDayKey(g.deadline, tz),
      title: `Objectif: ${g.name}`,
      type: 'savings',
      meta: {
        targetCents: g.targetCents.toString(),
        currentCents: g.currentCents.toString(),
      },
    });
  }

  // Personal calendar events (appointments, reminders)
  for (const ce of calendarEvents) {
    const startTime = ce.allDay ? null : tzTimeStr(ce.startAt, tz);
    const endTime = ce.allDay || !ce.endAt ? null : tzTimeStr(ce.endAt, tz);
    events.push({
      id: `event-${ce.id}`,
      date: tzDayKey(ce.startAt, tz),
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
      },
    });
  }

  return jsonb({ items: events }, ctx.requestId);
});

// POST /api/personal/calendar/events
export const POST = withPersonalRoute(async (ctx, req) => {
  const body = await req.json();
  const { kind, title, description, startAt, endAt, allDay, location, remindAt } = body as Record<string, unknown>;

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

  const event = await prisma.personalCalendarEvent.create({
    data: {
      userId: ctx.userId,
      kind: kind as CalendarEventKind,
      title: (title as string).trim(),
      description: typeof description === 'string' ? description.trim() || null : null,
      startAt: parsedStart,
      endAt: parsedEnd,
      allDay: allDay === true,
      location: typeof location === 'string' ? location.trim() || null : null,
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
      remindAt: event.remindAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
    },
  }, ctx.requestId);
});
