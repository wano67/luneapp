import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import icalGenerator from 'ical-generator';
import { projectRecurring } from '@/lib/calendar';

// GET /api/ical/{token} → .ics feed
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Try business token first, then personal token
  const businessToken = await prisma.calendarToken.findUnique({
    where: { token },
    select: { userId: true, businessId: true, revokedAt: true },
  });

  if (businessToken) {
    if (businessToken.revokedAt) {
      return new NextResponse('Token révoqué.', { status: 403 });
    }
    return buildBusinessFeed(businessToken.userId, businessToken.businessId);
  }

  const personalToken = await prisma.personalCalendarToken.findUnique({
    where: { token },
    select: { userId: true, revokedAt: true },
  });

  if (personalToken) {
    if (personalToken.revokedAt) {
      return new NextResponse('Token révoqué.', { status: 403 });
    }
    return buildPersonalFeed(personalToken.userId);
  }

  return new NextResponse('Token invalide.', { status: 404 });
}

// ──────────────────────────────────────────────────────────────────────────────
// Business calendar feed
// ──────────────────────────────────────────────────────────────────────────────

async function buildBusinessFeed(userId: bigint, businessId: bigint) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 6, 0);

  const [tasks, calendarEvents, interactions, recurringRules, business] = await Promise.all([
    prisma.task.findMany({
      where: { businessId, dueDate: { gte: from, lte: to }, status: { not: 'DONE' } },
      select: { id: true, title: true, dueDate: true, status: true, updatedAt: true },
    }),
    prisma.calendarEvent.findMany({
      where: { businessId, startAt: { gte: from, lte: to } },
      select: { id: true, kind: true, title: true, description: true, startAt: true, endAt: true, allDay: true, location: true, updatedAt: true },
    }),
    prisma.interaction.findMany({
      where: { businessId, OR: [{ happenedAt: { gte: from, lte: to } }, { nextActionDate: { gte: from, lte: to } }] },
      select: { id: true, type: true, content: true, happenedAt: true, nextActionDate: true, createdAt: true },
    }),
    prisma.financeRecurringRule.findMany({
      where: { businessId, isActive: true, startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
      select: { id: true, dayOfMonth: true, amountCents: true, category: true, vendor: true, frequency: true, startDate: true, endDate: true },
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
  ]);

  const cal = icalGenerator({ name: `Lune — ${business?.name ?? 'Pro'}`, timezone: 'Europe/Paris' });

  // Tasks
  for (const t of tasks) {
    if (!t.dueDate) continue;
    cal.createEvent({
      id: `task-${t.id}@lune.app`,
      summary: `[Tâche] ${t.title}`,
      start: t.dueDate,
      allDay: true,
      stamp: t.updatedAt,
    });
  }

  // Calendar events
  for (const ce of calendarEvents) {
    cal.createEvent({
      id: `event-${ce.id}@lune.app`,
      summary: ce.title,
      description: ce.description ?? undefined,
      location: ce.location ?? undefined,
      start: ce.startAt,
      end: ce.endAt ?? undefined,
      allDay: ce.allDay,
      stamp: ce.updatedAt,
    });
  }

  // Interactions (follow-ups)
  for (const i of interactions) {
    if (i.nextActionDate && i.nextActionDate >= from && i.nextActionDate <= to) {
      cal.createEvent({
        id: `interaction-next-${i.id}@lune.app`,
        summary: `[Suivi] ${i.content.slice(0, 80)}`,
        start: i.nextActionDate,
        allDay: true,
        stamp: i.createdAt,
      });
    }
  }

  // Recurring finance rules
  for (const rule of recurringRules) {
    const projected = projectRecurring({
      startDate: rule.startDate,
      endDate: rule.endDate,
      frequency: rule.frequency,
      dayOfMonth: rule.dayOfMonth,
      rangeFrom: from,
      rangeTo: to,
    });
    const label = rule.vendor ? `${rule.category} — ${rule.vendor}` : rule.category;
    for (const d of projected) {
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cal.createEvent({
        id: `finance-${rule.id}-${dk}@lune.app`,
        summary: `[Charge] ${label}`,
        start: d,
        allDay: true,
      });
    }
  }

  return new NextResponse(cal.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="lune-pro.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Personal calendar feed
// ──────────────────────────────────────────────────────────────────────────────

async function buildPersonalFeed(userId: bigint) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 6, 0);

  const [subscriptions, calendarEvents, goals] = await Promise.all([
    prisma.personalSubscription.findMany({
      where: { userId, isActive: true, startDate: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
      select: { id: true, name: true, amountCents: true, frequency: true, startDate: true, endDate: true },
    }),
    prisma.personalCalendarEvent.findMany({
      where: { userId, startAt: { gte: from, lte: to } },
      select: { id: true, kind: true, title: true, description: true, startAt: true, endAt: true, allDay: true, location: true, updatedAt: true },
    }),
    prisma.savingsGoal.findMany({
      where: { userId, isCompleted: false, deadline: { gte: from, lte: to } },
      select: { id: true, name: true, deadline: true, updatedAt: true },
    }),
  ]);

  const cal = icalGenerator({ name: 'Lune — Personnel', timezone: 'Europe/Paris' });

  // Subscriptions
  for (const sub of subscriptions) {
    const projected = projectRecurring({
      startDate: sub.startDate,
      endDate: sub.endDate,
      frequency: sub.frequency,
      rangeFrom: from,
      rangeTo: to,
    });
    for (const d of projected) {
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cal.createEvent({
        id: `sub-${sub.id}-${dk}@lune.app`,
        summary: `[Abo] ${sub.name}`,
        start: d,
        allDay: true,
      });
    }
  }

  // Calendar events
  for (const ce of calendarEvents) {
    cal.createEvent({
      id: `personal-event-${ce.id}@lune.app`,
      summary: ce.title,
      description: ce.description ?? undefined,
      location: ce.location ?? undefined,
      start: ce.startAt,
      end: ce.endAt ?? undefined,
      allDay: ce.allDay,
      stamp: ce.updatedAt,
    });
  }

  // Savings goals
  for (const g of goals) {
    if (!g.deadline) continue;
    cal.createEvent({
      id: `savings-${g.id}@lune.app`,
      summary: `[Objectif] ${g.name}`,
      start: g.deadline,
      allDay: true,
      stamp: g.updatedAt,
    });
  }

  return new NextResponse(cal.toString(), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="lune-perso.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
