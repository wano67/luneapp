import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { parseCentsInput } from '@/lib/money';
import { parseDateOpt } from '@/server/http/parsers';

function getGoalIdFromUrl(req: Request): bigint {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  return parseId(segments[segments.length - 1]);
}

// PATCH /api/personal/savings/[goalId]
export const PATCH = withPersonalRoute(async (ctx, req) => {
  const id = getGoalIdFromUrl(req);

  const goal = await prisma.savingsGoal.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!goal) return notFound('Objectif introuvable.');

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string' && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (body.targetCents != null) {
    const tc = parseCentsInput(body.targetCents);
    if (tc == null || tc <= 0) return badRequest('targetCents invalide.');
    data.targetCents = BigInt(tc);
  }
  if (body.currentCents != null) {
    const cc = parseCentsInput(body.currentCents);
    if (cc == null || cc < 0) return badRequest('currentCents invalide.');
    data.currentCents = BigInt(cc);
  }
  if ('deadline' in body) {
    data.deadline = parseDateOpt(body.deadline) ?? null;
  }
  if (typeof body.isCompleted === 'boolean') {
    data.isCompleted = body.isCompleted;
  }

  // Account link
  if ('accountId' in body) {
    if (body.accountId == null) {
      data.accountId = null;
    } else {
      try {
        const accountId = parseId(String(body.accountId));
        const acct = await prisma.personalAccount.findFirst({
          where: { id: accountId, userId: ctx.userId, type: 'SAVINGS' },
          select: { id: true },
        });
        if (!acct) return badRequest('Compte épargne introuvable.');
        data.accountId = accountId;
      } catch {
        return badRequest('accountId invalide.');
      }
    }
  }

  // Monthly contribution
  if ('monthlyContributionCents' in body) {
    if (body.monthlyContributionCents == null) {
      data.monthlyContributionCents = null;
    } else {
      const mc = parseCentsInput(body.monthlyContributionCents);
      if (mc == null || mc < 0) return badRequest('monthlyContributionCents invalide.');
      data.monthlyContributionCents = BigInt(mc);
    }
  }

  const updated = await prisma.savingsGoal.update({ where: { id }, data });

  return jsonb({ item: updated }, ctx.requestId);
});

// DELETE /api/personal/savings/[goalId]
export const DELETE = withPersonalRoute(async (ctx, req) => {
  const id = getGoalIdFromUrl(req);

  const goal = await prisma.savingsGoal.findFirst({
    where: { id, userId: ctx.userId },
    select: { id: true },
  });
  if (!goal) return notFound('Objectif introuvable.');

  await prisma.savingsGoal.delete({ where: { id } });

  return jsonbNoContent(ctx.requestId);
});
