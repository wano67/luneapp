import { prisma } from '@/server/db/client';
import { TaskStatus, FinanceType } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { buildProjectScopeWhere } from '@/server/queries/projects';

export const GET = withPersonalRoute(async (ctx) => {
  const memberships = await prisma.businessMembership.findMany({
    where: { userId: ctx.userId },
    include: { business: true },
  });

  if (!memberships.length) {
    return jsonb(
      {
        totals: { businessesCount: 0, projectsActiveCount: 0, totalNetCents: '0' },
        upcomingTasks: [],
      },
      ctx.requestId
    );
  }

  const businessIds = memberships.map((m) => m.businessId);

  const [projectsActiveCount, incomeSum, expenseSum, upcomingTasks] = await Promise.all([
    prisma.project.count({
      where: { businessId: { in: businessIds }, ...buildProjectScopeWhere({ scope: 'ACTIVE' }) },
    }),
    prisma.finance.aggregate({
      where: { businessId: { in: businessIds }, type: FinanceType.INCOME, deletedAt: null },
      _sum: { amountCents: true },
    }),
    prisma.finance.aggregate({
      where: { businessId: { in: businessIds }, type: FinanceType.EXPENSE, deletedAt: null },
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

  return jsonb(
    {
      totals: {
        businessesCount: memberships.length,
        projectsActiveCount,
        totalNetCents: (incomeTotal - expenseTotal).toString(),
      },
      upcomingTasks: tasksFiltered.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        businessId: t.businessId,
        businessName: t.business?.name ?? null,
        websiteUrl: t.business?.websiteUrl ?? null,
      })),
    },
    ctx.requestId
  );
});
