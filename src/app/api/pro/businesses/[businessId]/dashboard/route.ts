import { prisma } from '@/server/db/client';
import { TaskStatus, FinanceType } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { getProjectCounts } from '@/server/queries/projects';

function startOfMonth(date: Date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, count: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + count);
  return d;
}

function monthKey(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

// GET /api/pro/businesses/{businessId}/dashboard
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx) => {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const seriesStart = addMonths(monthStart, -11);
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
  ]);

  let mtdIncome = BigInt(0);
  let mtdExpense = BigInt(0);
  const monthBuckets = new Map<string, { income: bigint; expense: bigint }>();
  for (let i = 0; i < 12; i += 1) {
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

  const payload = {
    kpis: {
      projectsActiveCount,
      projectsCompletedCount,
      openTasksCount,
      mtdIncomeCents: mtdIncome,
      mtdExpenseCents: mtdExpense,
      mtdNetCents: mtdIncome - mtdExpense,
    },
    projects: {
      activeCount: projectCounts.active,
      plannedCount: projectCounts.planned,
      inactiveCount: projectCounts.inactive,
      archivedCount: projectCounts.archived,
      totalCount: projectCounts.total,
    },
    // Compatibilité avec l'ancien contrat UI
    clientsCount,
    projectsActiveCount,
    activeProjectsCount: projectsActiveCount,
    openTasksCount,
    monthFinance,
    latestTasks,
    latestFinances: [],
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
