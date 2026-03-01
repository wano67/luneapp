import { prisma } from '@/server/db/client';
import { BudgetPeriod } from '@/generated/prisma';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { parseCentsInput } from '@/lib/money';

function getBudgetIdFromUrl(req: Request): bigint {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return parseId(segments[segments.length - 1]);
}

// PATCH /api/personal/budgets/[budgetId]
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const id = getBudgetIdFromUrl(req);

  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!budget) return notFound('Budget introuvable.');

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.limitCents != null) {
    const lc = parseCentsInput(body.limitCents);
    if (lc == null || lc <= 0) return badRequest('limitCents invalide.');
    data.limitCents = BigInt(lc);
  }
  if (body.period != null) {
    data.period = body.period === 'YEARLY' ? BudgetPeriod.YEARLY : BudgetPeriod.MONTHLY;
  }
  if ('categoryId' in body) {
    if (body.categoryId == null) {
      data.categoryId = null;
    } else {
      try {
        const cid = BigInt(String(body.categoryId));
        const cat = await prisma.personalCategory.findFirst({
          where: { id: cid, userId: ctx.userId },
          select: { id: true },
        });
        if (!cat) return badRequest('Catégorie introuvable.');
        data.categoryId = cid;
      } catch {
        return badRequest('categoryId invalide.');
      }
    }
  }

  const updated = await prisma.personalBudget.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true } } },
  });

  return jsonb({ item: updated }, ctx.requestId);
});

// DELETE /api/personal/budgets/[budgetId]
export const DELETE = withPersonalRoute(async (ctx, req) => {
  const id = getBudgetIdFromUrl(req);

  const budget = await prisma.personalBudget.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!budget) return notFound('Budget introuvable.');

  await prisma.personalBudget.delete({ where: { id } });

  return jsonbNoContent(ctx.requestId);
});
