import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

export const GET = withPersonalRoute(async (ctx, req) => {
  const url = new URL(req.url);
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');

  const now = new Date();
  const from = fromRaw ? new Date(fromRaw) : startOfDayUTC(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = toRaw ? new Date(toRaw) : now;

  const dateWhere = { gte: from, lte: to };

  const [
    incomeAgg,
    expenseAgg,
    txnCount,
    topExpenseCategories,
    topExpenseLabels,
    perAccount,
  ] = await Promise.all([
    // Total income
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, type: 'INCOME', date: dateWhere },
      _sum: { amountCents: true },
    }),
    // Total expense
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, type: 'EXPENSE', date: dateWhere },
      _sum: { amountCents: true },
    }),
    // Count
    prisma.personalTransaction.count({
      where: { userId: ctx.userId, date: dateWhere },
    }),
    // Top expense categories
    prisma.personalTransaction.groupBy({
      by: ['categoryId'],
      where: { userId: ctx.userId, type: 'EXPENSE', date: dateWhere, categoryId: { not: null } },
      _sum: { amountCents: true },
      _count: true,
      orderBy: { _sum: { amountCents: 'asc' } },
      take: 8,
    }),
    // Top individual expenses (biggest single transactions)
    prisma.personalTransaction.findMany({
      where: { userId: ctx.userId, type: 'EXPENSE', date: dateWhere },
      orderBy: { amountCents: 'asc' },
      take: 5,
      select: { id: true, label: true, amountCents: true, date: true, currency: true, account: { select: { name: true } } },
    }),
    // Transactions per account
    prisma.personalTransaction.groupBy({
      by: ['accountId'],
      where: { userId: ctx.userId, date: dateWhere },
      _count: true,
      _sum: { amountCents: true },
    }),
  ]);

  // Resolve category names
  const categoryIds = topExpenseCategories
    .map((r) => r.categoryId!)
    .filter((id, i, arr) => arr.indexOf(id) === i);

  const categories = categoryIds.length
    ? await prisma.personalCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  // Resolve account names
  const accountIds = perAccount.map((r) => r.accountId);
  const accountsRaw = accountIds.length
    ? await prisma.personalAccount.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, name: true },
      })
    : [];
  const accMap = new Map(accountsRaw.map((a) => [a.id, a.name]));

  return jsonb(
    {
      totalIncomeCents: (incomeAgg._sum.amountCents ?? 0n).toString(),
      totalExpenseCents: (expenseAgg._sum.amountCents ?? 0n).toString(),
      txnCount,
      topExpenseCategories: topExpenseCategories.map((r) => ({
        name: catMap.get(r.categoryId!) ?? 'Sans catégorie',
        totalCents: (r._sum.amountCents ?? 0n).toString(),
        count: r._count,
      })),
      topExpenses: topExpenseLabels.map((t) => ({
        id: t.id,
        label: t.label,
        amountCents: t.amountCents.toString(),
        date: t.date,
        currency: t.currency,
        accountName: t.account.name,
      })),
      perAccount: perAccount.map((r) => ({
        accountId: r.accountId,
        accountName: accMap.get(r.accountId) ?? 'Compte',
        count: r._count,
        totalCents: (r._sum.amountCents ?? 0n).toString(),
      })),
    },
    ctx.requestId
  );
});
