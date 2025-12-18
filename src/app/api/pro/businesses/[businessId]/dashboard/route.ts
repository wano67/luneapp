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

function monthBounds(date: Date) {
  const start = new Date(date);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(start.getMonth() + 1);
  return { start, end };
}

function amountFromCents(value: bigint | null | undefined) {
  const cents = value ?? BigInt(0);
  return {
    amountCents: cents.toString(),
    amount: Number(cents) / 100,
  };
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
  const { start, end } = monthBounds(now);

  const [clientsCount, activeProjectsCount, openTasksCount, financeSums, latestTasks, latestFinances] =
    await Promise.all([
      prisma.client.count({ where: { businessId: businessIdBigInt } }),
      prisma.project.count({
        where: {
          businessId: businessIdBigInt,
          status: { notIn: [ProjectStatus.CANCELLED, ProjectStatus.COMPLETED] },
        },
      }),
      prisma.task.count({
        where: { businessId: businessIdBigInt, status: { not: TaskStatus.DONE } },
      }),
      prisma.finance.groupBy({
        by: ['type'],
        _sum: { amountCents: true },
        where: {
          businessId: businessIdBigInt,
          date: { gte: start, lt: end },
        },
      }),
      prisma.task.findMany({
        where: { businessId: businessIdBigInt },
        orderBy: [{ createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          createdAt: true,
        },
      }),
      prisma.finance.findMany({
        where: { businessId: businessIdBigInt },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          type: true,
          amountCents: true,
          category: true,
          date: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
    ]);

  const incomeSum = financeSums.find((f) => f.type === FinanceType.INCOME)?._sum.amountCents ?? null;
  const expenseSum = financeSums.find((f) => f.type === FinanceType.EXPENSE)?._sum.amountCents ?? null;

  const payload = {
    clientsCount,
    activeProjectsCount,
    openTasksCount,
    monthFinance: {
      income: amountFromCents(incomeSum),
      expense: amountFromCents(expenseSum),
      period: { start: start.toISOString(), end: end.toISOString() },
    },
    latestTasks: latestTasks.map((t) => ({
      id: t.id.toString(),
      title: t.title,
      status: t.status,
      dueDate: t.dueDate ? t.dueDate.toISOString() : null,
      createdAt: t.createdAt.toISOString(),
    })),
    latestFinances: latestFinances.map((f) => ({
      id: f.id.toString(),
      type: f.type,
      amountCents: f.amountCents.toString(),
      amount: Number(f.amountCents) / 100,
      category: f.category,
      date: f.date.toISOString(),
      projectId: f.projectId ? f.projectId.toString() : null,
      projectName: f.project?.name ?? null,
    })),
  };

  return withNoStore(withRequestId(jsonNoStore(payload), requestId));
}
