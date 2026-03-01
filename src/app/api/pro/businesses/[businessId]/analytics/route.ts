import { FinanceType, ProjectStatus } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { computeBusinessBillingSummary } from '@/server/billing/businessSummary';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addUtcMonths(date: Date, delta: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 0, 0, 0, 0));
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function absBigInt(value: bigint) {
  return value < 0n ? -value : value;
}

function toPercent(part: bigint, total: bigint) {
  if (total <= 0n) return 0;
  return Number((part * 10_000n) / total) / 100;
}

function compareBigIntDesc(a: bigint, b: bigint) {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

// GET /api/pro/businesses/{businessId}/analytics
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx) => {
  const now = new Date();
  const monthStart = startOfUtcMonth(now);
  const nextMonthStart = addUtcMonths(monthStart, 1);
  const trendStart = addUtcMonths(monthStart, -5);

  const [
    monthRevenueAgg,
    monthExpensesAgg,
    activeProjectsCount,
    completedProjectsCount,
    revenuesByProject,
    expensesByProject,
    expensesByCategoryRows,
    revenueRows,
    billingSummary,
  ] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        businessId: ctx.businessId,
        deletedAt: null,
        paidAt: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.finance.aggregate({
      where: {
        businessId: ctx.businessId,
        deletedAt: null,
        type: FinanceType.EXPENSE,
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.project.count({
      where: { businessId: ctx.businessId, status: ProjectStatus.ACTIVE, archivedAt: null },
    }),
    prisma.project.count({
      where: { businessId: ctx.businessId, status: ProjectStatus.COMPLETED },
    }),
    prisma.payment.groupBy({
      by: ['projectId'],
      where: {
        businessId: ctx.businessId,
        deletedAt: null,
        projectId: { not: null },
      },
      _sum: { amountCents: true },
    }),
    prisma.finance.groupBy({
      by: ['projectId'],
      where: {
        businessId: ctx.businessId,
        deletedAt: null,
        type: FinanceType.EXPENSE,
        projectId: { not: null },
      },
      _sum: { amountCents: true },
    }),
    prisma.finance.groupBy({
      by: ['category'],
      where: {
        businessId: ctx.businessId,
        deletedAt: null,
        type: FinanceType.EXPENSE,
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.payment.findMany({
      where: {
        businessId: ctx.businessId,
        deletedAt: null,
        paidAt: { gte: trendStart, lt: nextMonthStart },
      },
      select: { paidAt: true, amountCents: true },
    }),
    // Reused by design to keep billing math centralized.
    computeBusinessBillingSummary(ctx.businessId),
  ]);

  const totalRevenueCents = monthRevenueAgg._sum.amountCents ?? 0n;
  const rawMonthExpenses = monthExpensesAgg._sum.amountCents ?? 0n;
  const totalExpensesCents = absBigInt(rawMonthExpenses);
  const netMarginCents = totalRevenueCents - totalExpensesCents;

  const revenueMap = new Map<string, bigint>();
  for (const row of revenuesByProject) {
    if (row.projectId == null) continue;
    revenueMap.set(row.projectId.toString(), row._sum.amountCents ?? 0n);
  }

  const expenseMap = new Map<string, bigint>();
  for (const row of expensesByProject) {
    if (row.projectId == null) continue;
    expenseMap.set(row.projectId.toString(), absBigInt(row._sum.amountCents ?? 0n));
  }

  const projectIdStrings = Array.from(new Set([...revenueMap.keys(), ...expenseMap.keys()]));
  const projectIds = projectIdStrings.map((id) => BigInt(id));

  const projects =
    projectIds.length > 0
      ? await prisma.project.findMany({
          where: { businessId: ctx.businessId, id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : [];

  const projectNames = new Map(projects.map((project) => [project.id.toString(), project.name]));

  const projectProfitability = projectIdStrings
    .map((projectId) => {
      const revenueCents = revenueMap.get(projectId) ?? 0n;
      const expenseCents = expenseMap.get(projectId) ?? 0n;
      const marginPercent =
        revenueCents > 0n ? toPercent(revenueCents - expenseCents, revenueCents) : 0;

      return {
        projectId,
        name: projectNames.get(projectId) ?? `Projet #${projectId}`,
        revenueCents,
        expenseCents,
        marginPercent,
      };
    })
    .sort((a, b) => {
      const revenueOrder = compareBigIntDesc(a.revenueCents, b.revenueCents);
      if (revenueOrder !== 0) return revenueOrder;
      return compareBigIntDesc(a.expenseCents, b.expenseCents);
    })
    .slice(0, 5);

  const expensesByCategory = expensesByCategoryRows
    .map((row) => {
      const totalCents = absBigInt(row._sum.amountCents ?? 0n);
      return {
        category: row.category,
        totalCents,
        percent: toPercent(totalCents, totalExpensesCents),
      };
    })
    .sort((a, b) => compareBigIntDesc(a.totalCents, b.totalCents))
    .slice(0, 8);

  const revenueBuckets = new Map<string, bigint>();
  for (let i = 0; i < 6; i += 1) {
    revenueBuckets.set(monthKey(addUtcMonths(trendStart, i)), 0n);
  }

  for (const row of revenueRows) {
    const key = monthKey(startOfUtcMonth(row.paidAt));
    if (!revenueBuckets.has(key)) continue;
    revenueBuckets.set(key, (revenueBuckets.get(key) ?? 0n) + row.amountCents);
  }

  const revenueTrend = Array.from(revenueBuckets.entries()).map(([month, totalCents]) => ({
    month,
    totalCents,
  }));

  return jsonb(
    {
      totalRevenueCents,
      totalExpensesCents,
      netMarginCents,
      activeProjectsCount,
      completedProjectsCount,
      projectProfitability,
      expensesByCategory,
      revenueTrend,
      pendingCollectionCents: billingSummary.pendingCollectionCents,
    },
    ctx.requestId
  );
});
