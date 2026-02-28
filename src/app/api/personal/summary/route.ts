import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

export const GET = withPersonalRoute(async (ctx) => {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const startOfNextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
  );

  // 1) Accounts
  const accounts = await prisma.personalAccount.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      institution: true,
      iban: true,
      initialCents: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const accountIds = accounts.map((a) => a.id);

  // 2) Sum transactions by account
  const sumsByAccount = accountIds.length
    ? await prisma.personalTransaction.groupBy({
        by: ['accountId'],
        where: {
          userId: ctx.userId,
          accountId: { in: accountIds },
        },
        _sum: { amountCents: true },
      })
    : [];

  const sumMap = new Map<bigint, bigint>();
  for (const row of sumsByAccount) {
    sumMap.set(row.accountId, row._sum.amountCents ?? 0n);
  }

  const accountsWithBalance = accounts.map((a) => {
    const txSum = sumMap.get(a.id) ?? 0n;
    const balanceCents = a.initialCents + txSum;

    return {
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      institution: a.institution,
      iban: a.iban,
      initialCents: a.initialCents,
      balanceCents,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  });

  const totalBalanceCents = accountsWithBalance.reduce(
    (acc, a) => acc + a.balanceCents,
    0n
  );

  // 3) Month income/expense
  const [monthAgg, incomeAgg, expenseAgg] = await Promise.all([
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        date: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        date: { gte: startOfMonth, lt: startOfNextMonth },
        amountCents: { gt: 0n },
      },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        date: { gte: startOfMonth, lt: startOfNextMonth },
        amountCents: { lt: 0n },
      },
      _sum: { amountCents: true },
    }),
  ]);

  const monthNetCents = monthAgg._sum.amountCents ?? 0n;
  const monthIncomeCents = incomeAgg._sum.amountCents ?? 0n;
  const monthExpenseCents = expenseAgg._sum.amountCents ?? 0n;

  // 4) Latest transactions
  const latest = await prisma.personalTransaction.findMany({
    where: { userId: ctx.userId },
    orderBy: { date: 'desc' },
    take: 12,
    include: { account: true, category: true },
  });

  return jsonb(
    {
      kpis: {
        totalBalanceCents,
        monthNetCents,
        monthIncomeCents,
        monthExpenseCents,
      },
      accounts: accountsWithBalance,
      latestTransactions: latest.map((t) => ({
        id: t.id,
        type: t.type,
        date: t.date,
        amountCents: t.amountCents,
        currency: t.currency,
        label: t.label,
        note: t.note,
        account: { id: t.accountId, name: t.account.name },
        category: t.category ? { id: t.categoryId, name: t.category.name } : null,
      })),
    },
    ctx.requestId
  );
});
