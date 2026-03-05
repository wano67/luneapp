import { PersonalTransactionType } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
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

// GET /api/personal/analytics
export const GET = withPersonalRoute(async (ctx) => {
  const now = new Date();
  const monthStart = startOfUtcMonth(now);
  const nextMonthStart = addUtcMonths(monthStart, 1);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const trendStart = addUtcMonths(monthStart, -5);

  const [
    accounts,
    txSumsByAccount,
    monthIncomeAgg,
    monthExpenseAgg,
    monthExpensesByCategoryRows,
    trendTransactions,
    budgets,
    yearExpensesByCategoryRows,
    activeSubscriptions,
  ] = await Promise.all([
    prisma.personalAccount.findMany({
      where: { userId: ctx.userId },
      select: { id: true, initialCents: true },
    }),
    prisma.personalTransaction.groupBy({
      by: ['accountId'],
      where: { userId: ctx.userId },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        type: PersonalTransactionType.INCOME,
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        type: PersonalTransactionType.EXPENSE,
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: ctx.userId,
        type: PersonalTransactionType.EXPENSE,
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.findMany({
      where: {
        userId: ctx.userId,
        date: { gte: trendStart, lt: nextMonthStart },
      },
      select: { date: true, amountCents: true },
    }),
    prisma.personalBudget.findMany({
      where: { userId: ctx.userId },
      select: {
        id: true,
        name: true,
        period: true,
        limitCents: true,
        categoryId: true,
      },
    }),
    prisma.personalTransaction.groupBy({
      by: ['categoryId'],
      where: {
        userId: ctx.userId,
        type: PersonalTransactionType.EXPENSE,
        date: { gte: yearStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.personalSubscription.findMany({
      where: { userId: ctx.userId, isActive: true },
      select: { amountCents: true, frequency: true },
    }),
  ]);

  const txSumMap = new Map(txSumsByAccount.map((row) => [row.accountId.toString(), row._sum.amountCents ?? 0n]));
  const totalBalanceCents = accounts.reduce(
    (acc, account) => acc + account.initialCents + (txSumMap.get(account.id.toString()) ?? 0n),
    0n
  );

  const monthIncomeCents = absBigInt(monthIncomeAgg._sum.amountCents ?? 0n);
  const monthExpenseCents = absBigInt(monthExpenseAgg._sum.amountCents ?? 0n);
  const savingsRate = toPercent(monthIncomeCents - monthExpenseCents, monthIncomeCents);

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
  const variableChargesCents = monthExpenseCents > fixedChargesMonthlyCents
    ? monthExpenseCents - fixedChargesMonthlyCents
    : 0n;

  const monthCategoryIds = monthExpensesByCategoryRows
    .map((row) => row.categoryId)
    .filter((id): id is bigint => id !== null);
  const yearCategoryIds = yearExpensesByCategoryRows
    .map((row) => row.categoryId)
    .filter((id): id is bigint => id !== null);

  const uniqueCategoryIds = Array.from(
    new Set([...monthCategoryIds, ...yearCategoryIds].map((id) => id.toString()))
  ).map((id) => BigInt(id));

  const categories =
    uniqueCategoryIds.length > 0
      ? await prisma.personalCategory.findMany({
          where: { userId: ctx.userId, id: { in: uniqueCategoryIds } },
          select: { id: true, name: true },
        })
      : [];
  const categoryNames = new Map(categories.map((category) => [category.id.toString(), category.name]));

  const expensesByCategory = monthExpensesByCategoryRows
    .map((row) => {
      const totalCents = absBigInt(row._sum.amountCents ?? 0n);
      const name =
        row.categoryId === null
          ? 'Non catégorisé'
          : categoryNames.get(row.categoryId.toString()) ?? 'Catégorie';

      return {
        category: name,
        totalCents,
        percent: toPercent(totalCents, monthExpenseCents),
      };
    })
    .sort((a, b) => compareBigIntDesc(a.totalCents, b.totalCents))
    .slice(0, 8);

  const monthlyNet = new Map<string, bigint>();
  const monthKeys: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const key = monthKey(addUtcMonths(trendStart, i));
    monthKeys.push(key);
    monthlyNet.set(key, 0n);
  }

  for (const tx of trendTransactions) {
    const key = monthKey(startOfUtcMonth(tx.date));
    if (!monthlyNet.has(key)) continue;
    monthlyNet.set(key, (monthlyNet.get(key) ?? 0n) + tx.amountCents);
  }

  const closingBalanceByMonth = new Map<string, bigint>();
  let runningBalance = totalBalanceCents;
  for (let i = monthKeys.length - 1; i >= 0; i -= 1) {
    const key = monthKeys[i];
    closingBalanceByMonth.set(key, runningBalance);
    runningBalance -= monthlyNet.get(key) ?? 0n;
  }

  const balanceTrend = monthKeys.map((key) => ({
    month: key,
    balanceCents: closingBalanceByMonth.get(key) ?? 0n,
  }));

  const monthExpenseByCategory = new Map<string, bigint>();
  for (const row of monthExpensesByCategoryRows) {
    const key = row.categoryId?.toString() ?? 'uncategorized';
    monthExpenseByCategory.set(key, absBigInt(row._sum.amountCents ?? 0n));
  }

  const yearExpenseByCategory = new Map<string, bigint>();
  for (const row of yearExpensesByCategoryRows) {
    const key = row.categoryId?.toString() ?? 'uncategorized';
    yearExpenseByCategory.set(key, absBigInt(row._sum.amountCents ?? 0n));
  }

  const budgetVsActual = budgets.map((budget) => {
    const categoryKey = budget.categoryId?.toString() ?? 'uncategorized';
    const isYearly = budget.period === 'YEARLY';
    const spentCents = budget.categoryId
      ? isYearly
        ? yearExpenseByCategory.get(categoryKey) ?? 0n
        : monthExpenseByCategory.get(categoryKey) ?? 0n
      : isYearly
        ? absBigInt(
            Array.from(yearExpenseByCategory.values()).reduce((acc, value) => acc + value, 0n)
          )
        : monthExpenseCents;

    return {
      budgetName: budget.name,
      limitCents: budget.limitCents,
      spentCents,
      percent: toPercent(spentCents, budget.limitCents),
    };
  });

  return jsonb(
    {
      totalBalanceCents,
      monthIncomeCents,
      monthExpenseCents,
      savingsRate,
      fixedChargesMonthlyCents,
      variableChargesCents,
      expensesByCategory,
      balanceTrend,
      budgetVsActual,
    },
    ctx.requestId
  );
});
