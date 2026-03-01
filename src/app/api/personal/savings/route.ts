import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { parseCentsInput } from '@/lib/money';
import { parseDateOpt } from '@/server/http/parsers';

// GET /api/personal/savings
export const GET = withPersonalRoute(async (ctx) => {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'desc' },
  });

  return jsonb({ items: goals }, ctx.requestId);
});

// POST /api/personal/savings
export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:savings:create:${ctx.userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Payload invalide.');

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return badRequest('name requis.');

  const targetCents = parseCentsInput(body.targetCents);
  if (targetCents == null || targetCents <= 0) return badRequest('targetCents requis et > 0.');

  const currentCents = parseCentsInput(body.currentCents) ?? 0;
  const deadline = parseDateOpt(body.deadline) ?? null;

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: ctx.userId,
      name,
      targetCents: BigInt(targetCents),
      currentCents: BigInt(Math.max(0, currentCents)),
      deadline,
      isCompleted: false,
    },
  });

  return jsonbCreated({ item: goal }, ctx.requestId);
});
