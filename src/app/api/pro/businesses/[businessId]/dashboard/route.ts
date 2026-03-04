import { prisma } from '@/server/db/client';
import { TaskStatus, FinanceType } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { getProjectCounts } from '@/server/queries/projects';
import { computeBusinessBillingSummary, computeBusinessProjectMetrics } from '@/server/billing/businessSummary';
import { addMonths, startOfMonth, monthKey } from '@/lib/date';

// GET /api/pro/businesses/{businessId}/dashboard?days=30
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, req) => {
  // Period filter: 30, 60, 90, 180, 365, or 0 = all-time
  const daysParam = req.nextUrl.searchParams.get('days');
  const days = daysParam !== null ? Math.max(0, Math.min(3650, parseInt(daysParam, 10) || 30)) : 30;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const monthsBack = days === 0 ? 60 : Math.max(1, Math.ceil(days / 30));
  const seriesStart = addMonths(monthStart, -(monthsBack - 1));
  const periodStart = days > 0 ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000) : null;
  const periodDateFilter = periodStart ? { gte: periodStart } : undefined;
  const horizon = addMonths(now, 0);
  horizon.setDate(now.getDate() + 7);
  horizon.setHours(23, 59, 59, 999);

  const [
    clientsCount,
    projectCounts,
    openTasksCount,
    upcomingTasks,
    upcomingInteractions,
    financeRows,
    billingSummary,
    projectMetrics,
    allTimeIncomeAgg,
    allTimeExpenseAgg,
    latestFinanceRows,
  ] = await Promise.all([
    prisma.client.count({ where: { businessId: ctx.businessId } }),
    getProjectCounts({ businessId: ctx.businessId.toString() }),
    prisma.task.count({
      where: {
        businessId: ctx.businessId,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
    }),
    prisma.task.findMany({
      where: {
        businessId: ctx.businessId,
        status: { not: TaskStatus.DONE },
        dueDate: { gte: now, lte: horizon },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        projectId: true,
        project: { select: { name: true } },
        createdAt: true,
      },
    }),
    prisma.interaction.findMany({
      where: {
        businessId: ctx.businessId,
        nextActionDate: { gte: now, lte: horizon },
      },
      orderBy: [{ nextActionDate: 'asc' }, { createdAt: 'asc' }],
      take: 5,
      select: {
        id: true,
        type: true,
        nextActionDate: true,
        clientId: true,
        projectId: true,
      },
    }),
    prisma.finance.findMany({
      where: { businessId: ctx.businessId, deletedAt: null, date: { gte: seriesStart } },
      select: { date: true, type: true, amountCents: true },
    }),
    computeBusinessBillingSummary(ctx.businessId),
    computeBusinessProjectMetrics(ctx.businessId),
    prisma.finance.aggregate({
      where: { businessId: ctx.businessId, deletedAt: null, type: FinanceType.INCOME, ...(periodDateFilter ? { date: periodDateFilter } : {}) },
      _sum: { amountCents: true },
    }),
    prisma.finance.aggregate({
      where: { businessId: ctx.businessId, deletedAt: null, type: FinanceType.EXPENSE, ...(periodDateFilter ? { date: periodDateFilter } : {}) },
      _sum: { amountCents: true },
    }),
    prisma.finance.findMany({
      where: { businessId: ctx.businessId, deletedAt: null, ...(periodDateFilter ? { date: periodDateFilter } : {}) },
      orderBy: { date: 'desc' },
      take: 5,
      select: { id: true, type: true, amountCents: true, category: true, vendor: true, date: true, projectId: true },
    }),
  ]);

  // Opening balance: all finances BEFORE seriesStart
  const priorRows = await prisma.finance.findMany({
    where: { businessId: ctx.businessId, deletedAt: null, date: { lt: seriesStart } },
    select: { type: true, amountCents: true },
  });
  let openingBalanceCents = BigInt(0);
  for (const row of priorRows) {
    if (row.type === FinanceType.INCOME) openingBalanceCents += row.amountCents;
    else openingBalanceCents -= row.amountCents;
  }

  let mtdIncome = BigInt(0);
  let mtdExpense = BigInt(0);
  const monthBuckets = new Map<string, { income: bigint; expense: bigint }>();
  for (let i = 0; i < monthsBack; i += 1) {
    const key = monthKey(addMonths(seriesStart, i));
    monthBuckets.set(key, { income: BigInt(0), expense: BigInt(0) });
  }

  for (const row of financeRows) {
    const key = monthKey(startOfMonth(row.date));
    const bucket = monthBuckets.get(key);
    if (!bucket) continue;
    if (row.type === FinanceType.INCOME) {
      bucket.income += row.amountCents;
      if (row.date >= monthStart && row.date < nextMonthStart) {
        mtdIncome += row.amountCents;
      }
    } else if (row.type === FinanceType.EXPENSE) {
      bucket.expense += row.amountCents;
      if (row.date >= monthStart && row.date < nextMonthStart) {
        mtdExpense += row.amountCents;
      }
    }
  }

  const monthlySeries = Array.from(monthBuckets.entries()).map(([month, values]) => ({
    month,
    incomeCents: values.income,
    expenseCents: values.expense,
  }));

  const monthFinance = {
    income: { amountCents: mtdIncome, amount: Number(mtdIncome) / 100 },
    expense: { amountCents: mtdExpense, amount: Number(mtdExpense) / 100 },
    period: { start: monthStart, end: nextMonthStart },
  };

  const latestTasks = upcomingTasks.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    projectId: t.projectId,
    projectName: t.project?.name ?? null,
  }));

  const projectsActiveCount = projectCounts.active;
  const projectsCompletedCount = projectCounts.inactive;

  const allTimeIncomeCents = allTimeIncomeAgg._sum.amountCents ?? BigInt(0);
  const allTimeExpenseCents = allTimeExpenseAgg._sum.amountCents ?? BigInt(0);

  const payload = {
    days,
    kpis: {
      projectsActiveCount,
      projectsCompletedCount,
      openTasksCount,
      mtdIncomeCents: mtdIncome,
      mtdExpenseCents: mtdExpense,
      mtdNetCents: mtdIncome - mtdExpense,
    },
    treasury: {
      allTimeIncomeCents,
      allTimeExpenseCents,
      balanceCents: allTimeIncomeCents - allTimeExpenseCents,
      openingBalanceCents,
    },
    billing: {
      totalInvoicedCents: billingSummary.totalInvoicedCents,
      totalPaidCents: billingSummary.totalPaidCents,
      pendingCollectionCents: billingSummary.pendingCollectionCents,
      totalPlannedCents: billingSummary.totalPlannedCents,
    },
    projectMetrics: {
      avgProfitabilityPercent: projectMetrics.avgProfitabilityPercent,
      avgDurationDays: projectMetrics.avgDurationDays,
      completedProjectsCount: projectMetrics.completedProjectsCount,
    },
    projects: {
      activeCount: projectCounts.active,
      plannedCount: projectCounts.planned,
      inactiveCount: projectCounts.inactive,
      archivedCount: projectCounts.archived,
      totalCount: projectCounts.total,
    },
    clientsCount,
    projectsActiveCount,
    activeProjectsCount: projectsActiveCount,
    openTasksCount,
    monthFinance,
    latestTasks,
    latestFinances: latestFinanceRows,
    nextActions: {
      tasks: latestTasks,
      interactions: upcomingInteractions.map((i) => ({
        id: i.id,
        type: i.type,
        nextActionDate: i.nextActionDate,
        clientId: i.clientId,
        projectId: i.projectId,
      })),
    },
    monthlySeries,
  };

  return jsonb(payload, ctx.requestId);
});
