import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

const VALID_TYPES = ['CURRENT', 'SAVINGS', 'INVEST', 'CASH', 'LOAN'] as const;
type ValidType = (typeof VALID_TYPES)[number];

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

export const GET = withPersonalRoute(async (ctx, req) => {
  const url = new URL(req.url);
  const typesRaw = url.searchParams.get('types') ?? '';
  const types = typesRaw
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t): t is ValidType => VALID_TYPES.includes(t as ValidType));

  if (!types.length) {
    return jsonb({ income30d: '0', expense30d: '0', txnCount30d: 0, topExpenseCategories: [], topIncomeCategories: [] }, ctx.requestId);
  }

  const accounts = await prisma.personalAccount.findMany({
    where: { userId: ctx.userId, type: { in: types } },
    select: { id: true },
  });

  const accountIds = accounts.map((a) => a.id);
  if (!accountIds.length) {
    return jsonb({ income30d: '0', expense30d: '0', txnCount30d: 0, topExpenseCategories: [], topIncomeCategories: [] }, ctx.requestId);
  }

  const now = new Date();
  const since = startOfDayUTC(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [incomeAgg, expenseAgg, countResult, topExpenses, topIncome] = await Promise.all([
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, accountId: { in: accountIds }, type: 'INCOME', date: { gte: since } },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, accountId: { in: accountIds }, type: 'EXPENSE', date: { gte: since } },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.count({
      where: { userId: ctx.userId, accountId: { in: accountIds }, date: { gte: since } },
    }),
    prisma.personalTransaction.groupBy({
      by: ['categoryId'],
      where: { userId: ctx.userId, accountId: { in: accountIds }, type: 'EXPENSE', date: { gte: since }, categoryId: { not: null } },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: 'asc' } },
      take: 5,
    }),
    prisma.personalTransaction.groupBy({
      by: ['categoryId'],
      where: { userId: ctx.userId, accountId: { in: accountIds }, type: 'INCOME', date: { gte: since }, categoryId: { not: null } },
      _sum: { amountCents: true },
      orderBy: { _sum: { amountCents: 'desc' } },
      take: 5,
    }),
  ]);

  const categoryIds = [
    ...topExpenses.map((r) => r.categoryId!),
    ...topIncome.map((r) => r.categoryId!),
  ].filter((id, i, arr) => arr.indexOf(id) === i);

  const categories = categoryIds.length
    ? await prisma.personalCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  return jsonb(
    {
      income30d: (incomeAgg._sum.amountCents ?? 0n).toString(),
      expense30d: (expenseAgg._sum.amountCents ?? 0n).toString(),
      txnCount30d: countResult,
      topExpenseCategories: topExpenses.map((r) => ({
        name: catMap.get(r.categoryId!) ?? 'Sans catégorie',
        totalCents: (r._sum.amountCents ?? 0n).toString(),
      })),
      topIncomeCategories: topIncome.map((r) => ({
        name: catMap.get(r.categoryId!) ?? 'Sans catégorie',
        totalCents: (r._sum.amountCents ?? 0n).toString(),
      })),
    },
    ctx.requestId
  );
});
