import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { rateLimit } from '@/server/security/rateLimit';
import { NextResponse } from 'next/server';

/**
 * GET /api/personal/export — RGPD data portability (art. 20 RGPD).
 * Returns all personal data as a JSON file.
 */
export const GET = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:export:${ctx.userId}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const userId = ctx.userId;

  const [
    user,
    accounts,
    transactions,
    categories,
    categoryRules,
    budgets,
    savingsGoals,
    subscriptions,
    calendarEvents,
    notifications,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        language: true,
        theme: true,
        emailVerified: true,
        defaultCurrency: true,
        defaultTransactionType: true,
        defaultBudgetPeriod: true,
        defaultSubscriptionFrequency: true,
        dashboardPeriodDays: true,
        acceptedTermsAt: true,
        acceptedPrivacyAt: true,
        marketingConsentAt: true,
        createdAt: true,
      },
    }),
    prisma.personalAccount.findMany({
      where: { userId },
      select: {
        name: true,
        type: true,
        currency: true,
        institution: true,
        iban: true,
        initialCents: true,
        hidden: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.personalTransaction.findMany({
      where: { userId },
      select: {
        type: true,
        date: true,
        amountCents: true,
        currency: true,
        label: true,
        note: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { date: 'desc' },
    }),
    prisma.personalCategory.findMany({
      where: { userId },
      select: { name: true, icon: true, color: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.categoryRule.findMany({
      where: { userId },
      select: {
        pattern: true,
        matchType: true,
        priority: true,
        category: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.personalBudget.findMany({
      where: { userId },
      select: {
        name: true,
        limitCents: true,
        period: true,
        category: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.savingsGoal.findMany({
      where: { userId },
      select: {
        name: true,
        targetCents: true,
        currentCents: true,
        deadline: true,
        isCompleted: true,
        monthlyContributionCents: true,
        priority: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.personalSubscription.findMany({
      where: { userId },
      select: {
        name: true,
        amountCents: true,
        frequency: true,
        startDate: true,
        endDate: true,
        isActive: true,
        note: true,
        category: { select: { name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.personalCalendarEvent.findMany({
      where: { userId },
      select: {
        kind: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        allDay: true,
        location: true,
        createdAt: true,
      },
      orderBy: { startAt: 'desc' },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { type: true, title: true, body: true, isRead: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    format: 'Pivot RGPD Export v1',
    user: serialize(user),
    accounts: serialize(accounts),
    transactions: serialize(transactions),
    categories: serialize(categories),
    categoryRules: serialize(categoryRules),
    budgets: serialize(budgets),
    savingsGoals: serialize(savingsGoals),
    subscriptions: serialize(subscriptions),
    calendarEvents: serialize(calendarEvents),
    notifications: serialize(notifications),
  };

  const json = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="pivot-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});

function serialize(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serialize);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = serialize(v);
    }
    return result;
  }
  return obj;
}
