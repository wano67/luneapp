import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { TaskStatus, ProjectStatus, FinanceType } from '@/generated/prisma/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { getRequestId, badRequest, notFound, unauthorized, forbidden, withRequestId } from '@/server/http/apiUtils';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

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
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withRequestId(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withNoStore(withRequestId(badRequest('businessId invalide.'), requestId));
  }

  const business = await prisma.business.findUnique({
    where: { id: businessIdBigInt },
    select: { id: true },
  });
  if (!business) {
    return withNoStore(withRequestId(notFound('Entreprise introuvable.'), requestId));
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) {
    return withNoStore(withRequestId(forbidden(), requestId));
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const seriesStart = addMonths(monthStart, -11);
  const horizon = addMonths(now, 0);
  horizon.setDate(now.getDate() + 7);
  horizon.setHours(23, 59, 59, 999);

  const [
    clientsCount,
    projectsActiveCount,
    projectsCompletedCount,
    openTasksCount,
    upcomingTasks,
    upcomingInteractions,
    financeRows,
  ] = await Promise.all([
    prisma.client.count({ where: { businessId: businessIdBigInt } }),
    prisma.project.count({
      where: { businessId: businessIdBigInt, status: ProjectStatus.ACTIVE, archivedAt: null },
    }),
    prisma.project.count({
      where: { businessId: businessIdBigInt, status: ProjectStatus.COMPLETED, archivedAt: null },
    }),
    prisma.task.count({
      where: {
        businessId: businessIdBigInt,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
    }),
    prisma.task.findMany({
      where: {
        businessId: businessIdBigInt,
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
        businessId: businessIdBigInt,
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
      where: { businessId: businessIdBigInt, date: { gte: seriesStart } },
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
    incomeCents: values.income.toString(),
    expenseCents: values.expense.toString(),
  }));

  const monthFinance = {
    income: { amountCents: mtdIncome.toString(), amount: Number(mtdIncome) / 100 },
    expense: { amountCents: mtdExpense.toString(), amount: Number(mtdExpense) / 100 },
    period: { start: monthStart.toISOString(), end: nextMonthStart.toISOString() },
  };

  const latestTasks = upcomingTasks.map((t) => ({
    id: t.id.toString(),
    title: t.title,
    status: t.status,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    createdAt: t.createdAt ? t.createdAt.toISOString() : null,
    projectId: t.projectId ? t.projectId.toString() : null,
    projectName: t.project?.name ?? null,
  }));

  const payload = {
    kpis: {
      projectsActiveCount,
      projectsCompletedCount,
      openTasksCount,
      mtdIncomeCents: mtdIncome.toString(),
      mtdExpenseCents: mtdExpense.toString(),
      mtdNetCents: (mtdIncome - mtdExpense).toString(),
    },
    // Compatibilité avec l’ancien contrat UI
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
        id: i.id.toString(),
        type: i.type,
        nextActionDate: i.nextActionDate ? i.nextActionDate.toISOString() : null,
        clientId: i.clientId ? i.clientId.toString() : null,
        projectId: i.projectId ? i.projectId.toString() : null,
      })),
    },
    monthlySeries,
  };

  return withNoStore(withRequestId(jsonNoStore(payload), requestId));
}
