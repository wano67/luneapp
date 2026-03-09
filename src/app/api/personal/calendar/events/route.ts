import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest } from '@/server/http/apiUtils';
import { dayKey } from '@/lib/date';
import { projectRecurring, type CalendarEvent } from '@/lib/calendar';

// GET /api/personal/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD
export const GET = withPersonalRoute(async (ctx, req) => {
  const url = req.nextUrl;
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  if (!fromStr || !toStr) return badRequest('Paramètres from et to requis (YYYY-MM-DD).');

  const from = new Date(fromStr + 'T00:00:00Z');
  const to = new Date(toStr + 'T23:59:59Z');
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return badRequest('Dates invalides.');

  const [subscriptions, incomes, goals] = await Promise.all([
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
        id: `sub-${sub.id}-${dayKey(d)}`,
        date: dayKey(d),
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
      date: dayKey(inc.date),
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
      date: dayKey(g.deadline),
      title: `Objectif: ${g.name}`,
      type: 'savings',
      meta: {
        targetCents: g.targetCents.toString(),
        currentCents: g.currentCents.toString(),
      },
    });
  }

  return jsonb({ items: events }, ctx.requestId);
});
