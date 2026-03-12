import { prisma } from '@/server/db/client';
import { TaskStatus, FinanceType } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { getProjectCounts } from '@/server/queries/projects';
import { computeBusinessBillingSummary, computeBusinessProjectMetrics } from '@/server/billing/businessSummary';
import { addMonths, addDays, startOfMonth, startOfWeek, monthKey, dayKey, weekKey } from '@/lib/date';

// GET /api/pro/businesses/{businessId}/dashboard?days=30
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, req) => {
  // Period filter: 30, 60, 90, 180, 365, or 0 = all-time
  const daysParam = req.nextUrl.searchParams.get('days');
  const parsed = daysParam !== null ? parseInt(daysParam, 10) : Number.NaN;
  const days = Number.isFinite(parsed) ? Math.max(0, Math.min(3650, parsed)) : 30;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);

  // Granularity: daily ≤60d, weekly ≤180d, monthly otherwise
  const granularity: 'daily' | 'weekly' | 'monthly' =
    days > 0 && days <= 60 ? 'daily' : days > 60 && days <= 180 ? 'weekly' : 'monthly';

  // For "Global" (days=0): find the earliest record across ALL tables
  let monthsBack: number;
  if (days === 0) {
    const [earliestFinance, earliestInvoice, earliestQuote, earliestProject] = await Promise.all([
      prisma.finance.findFirst({
        where: { businessId: ctx.businessId, deletedAt: null },
        orderBy: { date: 'asc' },
        select: { date: true },
      }),
      prisma.invoice.findFirst({
        where: { businessId: ctx.businessId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.quote.findFirst({
        where: { businessId: ctx.businessId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      prisma.project.findFirst({
        where: { businessId: ctx.businessId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true, startDate: true },
      }),
    ]);
    const candidates: Date[] = [];
    if (earliestFinance) candidates.push(earliestFinance.date);
    if (earliestInvoice) candidates.push(earliestInvoice.createdAt);
    if (earliestQuote) candidates.push(earliestQuote.createdAt);
    if (earliestProject) {
      candidates.push(earliestProject.createdAt);
      if (earliestProject.startDate) candidates.push(earliestProject.startDate);
    }
    if (candidates.length > 0) {
      const earliest = new Date(Math.min(...candidates.map((d) => d.getTime())));
      const diffMs = monthStart.getTime() - startOfMonth(earliest).getTime();
      monthsBack = Math.max(1, Math.ceil(diffMs / (30.44 * 24 * 60 * 60 * 1000)) + 1);
    } else {
      monthsBack = 1;
    }
  } else {
    monthsBack = Math.max(1, Math.ceil(days / 30));
  }

  const seriesStart =
    granularity === 'monthly'
      ? addMonths(monthStart, -(monthsBack - 1))
      : days > 0
        ? new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        : addMonths(monthStart, -(monthsBack - 1));
  seriesStart.setHours(0, 0, 0, 0);

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
    prospectsActiveCount,
    prospectsWonCount,
    teamCount,
    overdueTasksCount,
    overdueInvoicesCount,
    latestInvoices,
    totalTasksCount,
    doneTasksCount,
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
    // Prospects pipeline
    prisma.prospect.count({ where: { businessId: ctx.businessId, status: { in: ['NEW', 'FOLLOW_UP'] } } }),
    prisma.prospect.count({ where: { businessId: ctx.businessId, status: 'WON' } }),
    // Team size
    prisma.businessMembership.count({ where: { businessId: ctx.businessId } }),
    // Overdue tasks (user-scoped — matches /my-tasks page the link goes to)
    prisma.task.count({
      where: {
        businessId: ctx.businessId,
        status: { not: TaskStatus.DONE },
        dueDate: { lt: now },
        OR: [
          { assigneeUserId: ctx.userId },
          { assignees: { some: { userId: ctx.userId } } },
        ],
      },
    }),
    // Overdue invoices
    prisma.invoice.count({
      where: { businessId: ctx.businessId, status: 'SENT', dueAt: { lt: now } },
    }),
    // Latest invoices
    prisma.invoice.findMany({
      where: { businessId: ctx.businessId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, number: true, status: true, totalCents: true, dueAt: true, clientId: true },
    }),
    // Task totals (avoids separate /tasks fetch on frontend)
    prisma.task.count({ where: { businessId: ctx.businessId } }),
    prisma.task.count({ where: { businessId: ctx.businessId, status: TaskStatus.DONE } }),
  ]);

  // Opening balance: aggregate finances BEFORE seriesStart (avoids unbounded fetch)
  const [priorIncome, priorExpense] = await Promise.all([
    prisma.finance.aggregate({
      where: { businessId: ctx.businessId, deletedAt: null, type: FinanceType.INCOME, date: { lt: seriesStart } },
      _sum: { amountCents: true },
    }),
    prisma.finance.aggregate({
      where: { businessId: ctx.businessId, deletedAt: null, type: FinanceType.EXPENSE, date: { lt: seriesStart } },
      _sum: { amountCents: true },
    }),
  ]);
  const openingBalanceCents = (priorIncome._sum.amountCents ?? BigInt(0)) - (priorExpense._sum.amountCents ?? BigInt(0));

  let mtdIncome = BigInt(0);
  let mtdExpense = BigInt(0);

  // Build buckets based on granularity
  const buckets = new Map<string, { income: bigint; expense: bigint }>();

  if (granularity === 'daily') {
    const totalDays = (days > 0 ? days : 60) + 1; // +1 to include today
    for (let i = 0; i < totalDays; i += 1) {
      buckets.set(dayKey(addDays(seriesStart, i)), { income: BigInt(0), expense: BigInt(0) });
    }
  } else if (granularity === 'weekly') {
    const weekStart = startOfWeek(seriesStart);
    const endDate = now;
    let cursor = new Date(weekStart);
    while (cursor <= endDate) {
      buckets.set(weekKey(cursor), { income: BigInt(0), expense: BigInt(0) });
      cursor = addDays(cursor, 7);
    }
  } else {
    for (let i = 0; i < monthsBack; i += 1) {
      buckets.set(monthKey(addMonths(seriesStart, i)), { income: BigInt(0), expense: BigInt(0) });
    }
  }

  function bucketKey(date: Date): string {
    if (granularity === 'daily') return dayKey(date);
    if (granularity === 'weekly') return weekKey(date);
    return monthKey(startOfMonth(date));
  }

  for (const row of financeRows) {
    const key = bucketKey(row.date);
    const bucket = buckets.get(key);
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

  const timeSeries = Array.from(buckets.entries()).map(([label, values]) => ({
    label,
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
    periodRevenueCents: allTimeIncomeCents,
    periodExpenseCents: allTimeExpenseCents,
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
    prospectsActiveCount,
    prospectsWonCount,
    teamCount,
    totalTasksCount,
    doneTasksCount,
    overdueTasksCount,
    overdueInvoicesCount,
    latestInvoices: latestInvoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      totalCents: inv.totalCents,
      dueDate: inv.dueAt,
      clientId: inv.clientId,
    })),
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
    granularity,
    timeSeries,
    monthlySeries: timeSeries,
  };

  return jsonb(payload, ctx.requestId);
});
