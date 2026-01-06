import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { ProjectStatus, TaskStatus, FinanceType } from '@/generated/prisma';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { getRequestId, unauthorized, withRequestId } from '@/server/http/apiUtils';
import { jsonNoStore, withNoStore } from '@/server/security/csrf';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withNoStore(withRequestId(unauthorized(), requestId));
  }

  const memberships = await prisma.businessMembership.findMany({
    where: { userId: BigInt(userId) },
    include: { business: true },
  });

  if (!memberships.length) {
    return withNoStore(
      withRequestId(
        jsonNoStore({
          totals: { businessesCount: 0, projectsActiveCount: 0, totalNetCents: '0' },
          upcomingTasks: [],
        }),
        requestId
      )
    );
  }

  const businessIds = memberships.map((m) => m.businessId);

  const [projectsActiveCount, incomeSum, expenseSum, upcomingTasks] = await Promise.all([
    prisma.project.count({
      where: { businessId: { in: businessIds }, status: ProjectStatus.ACTIVE, archivedAt: null },
    }),
    prisma.finance.aggregate({
      where: { businessId: { in: businessIds }, type: FinanceType.INCOME },
      _sum: { amountCents: true },
    }),
    prisma.finance.aggregate({
      where: { businessId: { in: businessIds }, type: FinanceType.EXPENSE },
      _sum: { amountCents: true },
    }),
    prisma.task.findMany({
      where: {
        businessId: { in: businessIds },
        status: { not: TaskStatus.DONE },
        dueDate: { not: null },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: 50,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        businessId: true,
        business: { select: { name: true, websiteUrl: true } },
      },
    }),
  ]);

  const incomeTotal = incomeSum._sum.amountCents ?? BigInt(0);
  const expenseTotal = expenseSum._sum.amountCents ?? BigInt(0);

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const now = new Date();
  const tasksFiltered = upcomingTasks.filter((t) => t.dueDate && t.dueDate <= horizon && t.dueDate >= now);

  return withNoStore(
    withRequestId(
      jsonNoStore({
        totals: {
          businessesCount: memberships.length,
          projectsActiveCount,
          totalNetCents: (incomeTotal - expenseTotal).toString(),
        },
        upcomingTasks: tasksFiltered.map((t) => ({
          id: t.id.toString(),
          title: t.title,
          status: t.status,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
          businessId: t.businessId.toString(),
          businessName: t.business?.name ?? null,
          websiteUrl: t.business?.websiteUrl ?? null,
        })),
      }),
      requestId
    )
  );
}
