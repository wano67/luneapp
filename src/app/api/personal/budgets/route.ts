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

  const categoryIds = budgets
    .filter((b) => b.categoryId !== null)
    .map((b) => b.categoryId!);

  const spending = categoryIds.length
    ? await prisma.personalTransaction.groupBy({
        by: ['categoryId'],
        where: {
          userId: ctx.userId,
          categoryId: { in: categoryIds },
          date: { gte: monthStart },
          type: 'EXPENSE',
        },
        _sum: { amountCents: true },
      })
    : [];

  const spendMap = new Map<bigint, bigint>();
  for (const row of spending) {
    if (row.categoryId) spendMap.set(row.categoryId, row._sum.amountCents ?? 0n);
  }

  return jsonb(
    {
      items: budgets.map((b) => ({
        id: b.id,
        name: b.name,
        period: b.period,
        limitCents: b.limitCents,
        spentCents: b.categoryId ? (spendMap.get(b.categoryId) ?? 0n) : 0n,
        category: b.category,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
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
