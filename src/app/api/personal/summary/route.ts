import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

export const GET = withPersonalRoute(async (ctx, req) => {
  const now = new Date();

  // Period filtering: ?days=30|60|90|180|365 (default: current month)
  const daysParam = new URL(req.url).searchParams.get('days');
  const days = daysParam ? Math.min(Math.max(parseInt(daysParam, 10) || 0, 0), 365) : 0;

  let periodStart: Date;
  let periodEnd: Date;
  if (days > 0) {
    periodEnd = now;
    periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    periodStart.setUTCHours(0, 0, 0, 0);
  } else {
    // Default: current calendar month
    periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  }
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));

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
      bankCode: true,
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
      bankCode: a.bankCode,
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

  // 3) Period income/expense (respects ?days= param) + previous period for comparison
  const prevPeriodEnd = periodStart;
  const prevPeriodStart = new Date(periodStart.getTime() - (periodEnd.getTime() - periodStart.getTime()));

  const [monthAgg, incomeAgg, expenseAgg, prevIncomeAgg, prevExpenseAgg] = await Promise.all([
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, date: { gte: periodStart, lt: periodEnd } },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, date: { gte: periodStart, lt: periodEnd }, amountCents: { gt: 0n } },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, date: { gte: periodStart, lt: periodEnd }, amountCents: { lt: 0n } },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, date: { gte: prevPeriodStart, lt: prevPeriodEnd }, amountCents: { gt: 0n } },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, date: { gte: prevPeriodStart, lt: prevPeriodEnd }, amountCents: { lt: 0n } },
      _sum: { amountCents: true },
    }),
  ]);

  const monthNetCents = monthAgg._sum.amountCents ?? 0n;
  const monthIncomeCents = incomeAgg._sum.amountCents ?? 0n;
  const monthExpenseCents = expenseAgg._sum.amountCents ?? 0n;
  const prevIncomeCents = prevIncomeAgg._sum.amountCents ?? 0n;
  const prevExpenseCents = prevExpenseAgg._sum.amountCents ?? 0n;

  // 3b) Savings capacity: fixed charges + average variable expenses
  const threeMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1, 0, 0, 0));

  const [activeSubscriptions, variableExpenses3m] = await Promise.all([
    prisma.personalSubscription.findMany({
      where: { userId: ctx.userId, isActive: true },
      select: { amountCents: true, frequency: true },
    }),
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        amountCents: { lt: 0n },
        date: { gte: threeMonthsAgo, lt: startOfMonth },
      },
      _sum: { amountCents: true },
    }),
  ]);

  function toMonthlyCents(amountCents: bigint, frequency: string): bigint {
    switch (frequency) {
      case 'WEEKLY':    return (amountCents * 52n) / 12n;
      case 'QUARTERLY': return (amountCents * 4n) / 12n;
      case 'YEARLY':    return amountCents / 12n;
      default:          return amountCents;
    }
  }

  const fixedChargesMonthlyCents = activeSubscriptions.reduce(
    (acc, s) => acc + toMonthlyCents(s.amountCents, s.frequency),
    0n
  );

  const totalVar3m = -(variableExpenses3m._sum.amountCents ?? 0n);
  const avgVariableMonthlyCents = totalVar3m > 0n ? totalVar3m / 3n : 0n;
  const savingsCapacityCents = monthIncomeCents - fixedChargesMonthlyCents - avgVariableMonthlyCents;

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
        prevIncomeCents,
        prevExpenseCents,
        savingsCapacityCents,
        fixedChargesMonthlyCents,
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
