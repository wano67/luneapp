import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { parseCentsInput } from '@/lib/money';
import { parseDateOpt, parseId } from '@/server/http/parsers';

// GET /api/personal/savings
export const GET = withPersonalRoute(async (ctx) => {
  const [goals, savingsAccounts, investAccounts] = await Promise.all([
    prisma.savingsGoal.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        account: { select: { id: true, name: true, initialCents: true, type: true } },
      },
    }),
    prisma.personalAccount.findMany({
      where: { userId: ctx.userId, type: 'SAVINGS', hidden: false },
      select: { id: true, name: true, initialCents: true, interestRateBps: true },
    }),
    prisma.personalAccount.findMany({
      where: { userId: ctx.userId, type: 'INVEST', hidden: false },
      select: { id: true, name: true, initialCents: true, interestRateBps: true },
    }),
  ]);

  // Compute balances for savings + invest accounts (initialCents + SUM(transactions))
  const allAccountIds = [...savingsAccounts, ...investAccounts].map((a) => a.id);
  const txSums = allAccountIds.length > 0
    ? await prisma.personalTransaction.groupBy({
        by: ['accountId'],
        where: { accountId: { in: allAccountIds } },
        _sum: { amountCents: true },
      })
    : [];

  const txSumMap = new Map(txSums.map((t) => [t.accountId.toString(), t._sum.amountCents ?? 0n]));

  function withBalance<T extends { id: bigint; initialCents: bigint }>(accounts: T[]) {
    return accounts.map((a) => ({
      ...a,
      balanceCents: a.initialCents + (txSumMap.get(a.id.toString()) ?? 0n),
    }));
  }

  const savingsAccountsWithBalance = withBalance(savingsAccounts);
  const investAccountsWithBalance = withBalance(investAccounts);

  const savingsAccountsTotalCents = savingsAccountsWithBalance.reduce(
    (s, a) => s + a.balanceCents, 0n
  );
  const investAccountsTotalCents = investAccountsWithBalance.reduce(
    (s, a) => s + a.balanceCents, 0n
  );

  const totalSavedCents = goals.reduce((s, g) => s + g.currentCents, 0n);
  const totalTargetCents = goals.reduce((s, g) => s + g.targetCents, 0n);

  // Enrich goals with projections
  const now = new Date();
  const enrichedGoals = goals.map((g) => {
    const remaining = g.targetCents - g.currentCents;
    let monthlyNeededCents: bigint | null = null;
    let projectedDate: string | null = null;
    const percentComplete = g.targetCents > 0n
      ? Number((g.currentCents * 10000n) / g.targetCents) / 100
      : 0;

    // Monthly needed to reach target before deadline
    if (g.deadline && remaining > 0n) {
      const deadlineDate = new Date(g.deadline);
      const monthsLeft = Math.max(1,
        (deadlineDate.getFullYear() - now.getFullYear()) * 12 +
        (deadlineDate.getMonth() - now.getMonth())
      );
      monthlyNeededCents = remaining / BigInt(monthsLeft);
    }

    // Projected date at current monthly contribution rate
    if (g.monthlyContributionCents && g.monthlyContributionCents > 0n && remaining > 0n) {
      const monthsToGo = Number(remaining / g.monthlyContributionCents);
      const projected = new Date(now);
      projected.setMonth(projected.getMonth() + monthsToGo);
      projectedDate = projected.toISOString();
    }

    // Compute account balance if linked
    let accountBalance: { id: bigint; name: string; balanceCents: bigint } | null = null;
    if (g.account) {
      const found = savingsAccountsWithBalance.find((a) => a.id === g.accountId);
      if (found) {
        accountBalance = { id: found.id, name: found.name, balanceCents: found.balanceCents };
      }
    }

    return {
      ...g,
      account: accountBalance,
      monthlyNeededCents,
      projectedDate,
      percentComplete,
    };
  });

  return jsonb({
    savingsAccountsTotalCents,
    investAccountsTotalCents,
    totalPatrimoineCents: savingsAccountsTotalCents + investAccountsTotalCents,
    totalSavedCents,
    totalTargetCents,
    savingsAccounts: savingsAccountsWithBalance,
    investAccounts: investAccountsWithBalance,
    items: enrichedGoals,
  }, ctx.requestId);
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
  const monthlyContributionCents = parseCentsInput(body.monthlyContributionCents);

  // Validate accountId if provided
  let accountId: bigint | null = null;
  if (body.accountId != null) {
    try {
      accountId = parseId(String(body.accountId));
      const acct = await prisma.personalAccount.findFirst({
        where: { id: accountId, userId: ctx.userId, type: 'SAVINGS' },
        select: { id: true },
      });
      if (!acct) return badRequest('Compte épargne introuvable.');
    } catch {
      return badRequest('accountId invalide.');
    }
  }

  const goal = await prisma.savingsGoal.create({
    data: {
      userId: ctx.userId,
      name,
      targetCents: BigInt(targetCents),
      currentCents: BigInt(Math.max(0, currentCents)),
      deadline,
      isCompleted: false,
      accountId,
      monthlyContributionCents: monthlyContributionCents != null ? BigInt(monthlyContributionCents) : null,
    },
  });

  return jsonbCreated({ item: goal }, ctx.requestId);
});
