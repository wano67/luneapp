import { prisma } from '@/server/db/client';
import { BudgetPeriod } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { parseCentsInput } from '@/lib/money';

// GET /api/personal/budgets
export const GET = withPersonalRoute(async (ctx) => {
  const budgets = await prisma.personalBudget.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'desc' },
    include: { category: { select: { id: true, name: true } } },
  });

  // For each MONTHLY budget, compute spending this month
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [categorySpending, totalExpenseAgg, totalIncomeAgg, savingsGoals, activeSubscriptions] = await Promise.all([
    budgets.some((b) => b.categoryId !== null)
      ? prisma.personalTransaction.groupBy({
          by: ['categoryId'],
          where: {
            userId: ctx.userId,
            categoryId: { in: budgets.filter((b) => b.categoryId !== null).map((b) => b.categoryId!) },
            date: { gte: monthStart, lt: nextMonthStart },
            type: 'EXPENSE',
          },
          _sum: { amountCents: true },
        })
      : Promise.resolve([]),
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        type: 'EXPENSE',
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        type: 'INCOME',
        date: { gte: monthStart, lt: nextMonthStart },
      },
      _sum: { amountCents: true },
    }),
    prisma.savingsGoal.findMany({
      where: {
        userId: ctx.userId,
        isCompleted: false,
        monthlyContributionCents: { not: null, gt: 0n },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        targetCents: true,
        monthlyContributionCents: true,
        priority: true,
        deadline: true,
      },
    }),
    prisma.personalSubscription.findMany({
      where: { userId: ctx.userId, isActive: true },
      select: { amountCents: true, frequency: true },
    }),
  ]);

  const spendMap = new Map<bigint, bigint>();
  for (const row of categorySpending) {
    if (row.categoryId) spendMap.set(row.categoryId, row._sum.amountCents ?? 0n);
  }

  const rawExpense = totalExpenseAgg._sum.amountCents ?? 0n;
  const monthExpenseCents = rawExpense < 0n ? -rawExpense : rawExpense;

  const rawIncome = totalIncomeAgg._sum.amountCents ?? 0n;
  const monthIncomeCents = rawIncome < 0n ? -rawIncome : rawIncome;

  const totalSavingsBudgetCents = savingsGoals.reduce(
    (s, g) => s + (g.monthlyContributionCents ?? 0n), 0n,
  );

  // Compute total spending in budgeted categories
  let budgetedExpenseCents = 0n;
  for (const amount of spendMap.values()) {
    budgetedExpenseCents += amount < 0n ? -amount : amount;
  }
  const unbudgetedExpenseCents = monthExpenseCents > budgetedExpenseCents
    ? monthExpenseCents - budgetedExpenseCents
    : 0n;

  // Compute total fixed charges (subscriptions) monthly equivalent
  function toMonthlyCents(amountCents: bigint, frequency: string): bigint {
    switch (frequency) {
      case 'WEEKLY':    return (amountCents * 52n) / 12n;
      case 'QUARTERLY': return amountCents / 3n;
      case 'YEARLY':    return amountCents / 12n;
      default:          return amountCents;
    }
  }
  const totalFixedChargesMonthlyCents = activeSubscriptions.reduce(
    (sum, s) => sum + toMonthlyCents(s.amountCents < 0n ? -s.amountCents : s.amountCents, s.frequency),
    0n,
  );

  return jsonb(
    {
      monthExpenseCents,
      monthIncomeCents,
      unbudgetedExpenseCents,
      totalFixedChargesMonthlyCents,
      items: budgets.map((b) => {
        const rawSpent = b.categoryId ? (spendMap.get(b.categoryId) ?? 0n) : 0n;
        return {
          id: b.id,
          name: b.name,
          period: b.period,
          limitCents: b.limitCents,
          spentCents: rawSpent < 0n ? -rawSpent : rawSpent,
          category: b.category,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      }),
      savingsGoals: savingsGoals.map((g) => ({
        id: g.id,
        name: g.name,
        targetCents: g.targetCents,
        monthlyContributionCents: g.monthlyContributionCents,
        priority: g.priority,
        deadline: g.deadline,
      })),
      totalSavingsBudgetCents,
    },
    ctx.requestId
  );
});

// POST /api/personal/budgets
export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:budgets:create:${ctx.userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return badRequest('name requis.');

  const limitCents = parseCentsInput(body.limitCents);
  if (limitCents == null || limitCents <= 0) return badRequest('limitCents requis et > 0.');

  const period =
    body.period === 'YEARLY' ? BudgetPeriod.YEARLY : BudgetPeriod.MONTHLY;

  let categoryId: bigint | null = null;
  if (body.categoryId != null) {
    try {
      categoryId = BigInt(String(body.categoryId));
      const cat = await prisma.personalCategory.findFirst({
        where: { id: categoryId, userId: ctx.userId },
        select: { id: true },
      });
      if (!cat) return badRequest('Catégorie introuvable.');
    } catch {
      return badRequest('categoryId invalide.');
    }
  }

  const budget = await prisma.personalBudget.create({
    data: {
      userId: ctx.userId,
      name,
      limitCents: BigInt(limitCents),
      period,
      categoryId,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return jsonbCreated({ item: budget }, ctx.requestId);
});
