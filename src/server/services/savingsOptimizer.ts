import { prisma } from '@/server/db/client';
import { REFERENCE_RATES, bestReferenceRate } from '@/config/interestRates';

export type AccountOptimization = {
  accountId: bigint;
  accountName: string;
  balanceCents: bigint;
  currentRateBps: number | null;
  bestRateBps: number;
  bestRateLabel: string;
  annualGainCents: bigint; // potential gain if switching to best rate
};

export type SavingsInsight = {
  type: 'info' | 'warning' | 'success';
  title: string;
  description: string;
};

export type GoalTimeline = {
  goalId: bigint;
  goalName: string;
  percentComplete: number;
  monthlyNeededCents: bigint | null;
  deadline: Date | null;
  onTrack: boolean | null; // null if no deadline
};

export type SavingsAnalysis = {
  // Capacity
  avgMonthlyIncomeCents: bigint;
  avgMonthlyExpenseCents: bigint;
  fixedChargesCents: bigint;
  savingsCapacityCents: bigint;
  savingsRatePercent: number;

  // Score (0-100)
  healthScore: number;

  // Interest optimization
  totalEstimatedAnnualInterestCents: bigint;
  accountOptimizations: AccountOptimization[];

  // Goal timelines
  goalTimelines: GoalTimeline[];

  // Insights
  insights: SavingsInsight[];
};

/**
 * Analyse complète de la santé financière d'un utilisateur.
 */
export async function analyzeSavings(userId: bigint): Promise<SavingsAnalysis> {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // ── Fetch data ──
  const [incomeAgg, expenseAgg, activeSubs, savingsAccounts, goals] = await Promise.all([
    // Average monthly income (last 6 months)
    prisma.personalTransaction.aggregate({
      where: {
        userId,
        date: { gte: sixMonthsAgo },
        amountCents: { gt: 0n },
      },
      _sum: { amountCents: true },
    }),
    // Average monthly expense (last 6 months, absolute)
    prisma.personalTransaction.aggregate({
      where: {
        userId,
        date: { gte: sixMonthsAgo },
        amountCents: { lt: 0n },
      },
      _sum: { amountCents: true },
    }),
    // Active subscriptions
    prisma.personalSubscription.findMany({
      where: { userId, isActive: true },
      select: { amountCents: true, frequency: true },
    }),
    // Savings accounts
    prisma.personalAccount.findMany({
      where: { userId, type: 'SAVINGS', hidden: false },
      select: { id: true, name: true, initialCents: true, interestRateBps: true },
    }),
    // Savings goals
    prisma.savingsGoal.findMany({
      where: { userId, isCompleted: false },
      select: {
        id: true,
        name: true,
        targetCents: true,
        currentCents: true,
        deadline: true,
        monthlyContributionCents: true,
      },
    }),
  ]);

  // ── Compute account balances ──
  const accountIds = savingsAccounts.map((a) => a.id);
  const txSums = accountIds.length > 0
    ? await prisma.personalTransaction.groupBy({
        by: ['accountId'],
        where: { accountId: { in: accountIds } },
        _sum: { amountCents: true },
      })
    : [];
  const txSumMap = new Map(txSums.map((t) => [t.accountId.toString(), t._sum.amountCents ?? 0n]));

  const accountsWithBalance = savingsAccounts.map((a) => ({
    ...a,
    balanceCents: a.initialCents + (txSumMap.get(a.id.toString()) ?? 0n),
  }));

  // ── Averages (over 6 months) ──
  const totalIncome = incomeAgg._sum.amountCents ?? 0n;
  const totalExpense = expenseAgg._sum.amountCents ?? 0n; // negative
  const avgMonthlyIncomeCents = totalIncome / 6n;
  const avgMonthlyExpenseCents = totalExpense < 0n ? -totalExpense / 6n : 0n;

  // ── Fixed charges (subscriptions) ──
  const fixedChargesCents = activeSubs.reduce((acc, s) => {
    const monthly = toMonthlyCentsBigint(s.amountCents, s.frequency);
    return acc + monthly;
  }, 0n);

  // ── Savings capacity ──
  const variableExpenses = avgMonthlyExpenseCents > fixedChargesCents
    ? avgMonthlyExpenseCents - fixedChargesCents
    : 0n;
  const savingsCapacityCents = avgMonthlyIncomeCents > (fixedChargesCents + variableExpenses)
    ? avgMonthlyIncomeCents - fixedChargesCents - variableExpenses
    : 0n;

  const savingsRatePercent = avgMonthlyIncomeCents > 0n
    ? Number((savingsCapacityCents * 10000n) / avgMonthlyIncomeCents) / 100
    : 0;

  // ── Interest optimization ──
  const accountOptimizations: AccountOptimization[] = [];
  let totalEstimatedAnnualInterestCents = 0n;

  for (const acct of accountsWithBalance) {
    if (acct.balanceCents <= 0n) continue;

    const currentRate = acct.interestRateBps ?? 0;
    const bestRef = bestReferenceRate(acct.balanceCents);
    const bestRate = bestRef?.rateBps ?? REFERENCE_RATES[0]?.rateBps ?? 250;
    const bestLabel = bestRef?.label ?? 'Livret A';

    const currentAnnual = (acct.balanceCents * BigInt(currentRate)) / 10000n;
    const bestAnnual = (acct.balanceCents * BigInt(bestRate)) / 10000n;
    const gain = bestAnnual - currentAnnual;

    totalEstimatedAnnualInterestCents += currentAnnual;

    if (gain > 0n || currentRate === 0) {
      accountOptimizations.push({
        accountId: acct.id,
        accountName: acct.name,
        balanceCents: acct.balanceCents,
        currentRateBps: acct.interestRateBps,
        bestRateBps: bestRate,
        bestRateLabel: bestLabel,
        annualGainCents: gain,
      });
    }
  }

  // ── Goal timelines ──
  const goalTimelines: GoalTimeline[] = goals.map((g) => {
    const remaining = g.targetCents - g.currentCents;
    const percentComplete = g.targetCents > 0n
      ? Number((g.currentCents * 10000n) / g.targetCents) / 100
      : 0;

    let monthlyNeededCents: bigint | null = null;
    let onTrack: boolean | null = null;

    if (g.deadline && remaining > 0n) {
      const deadlineDate = new Date(g.deadline);
      const monthsLeft = Math.max(1,
        (deadlineDate.getFullYear() - now.getFullYear()) * 12 +
        (deadlineDate.getMonth() - now.getMonth())
      );
      monthlyNeededCents = remaining / BigInt(monthsLeft);

      if (g.monthlyContributionCents && g.monthlyContributionCents > 0n) {
        onTrack = g.monthlyContributionCents >= monthlyNeededCents;
      } else {
        onTrack = savingsCapacityCents >= monthlyNeededCents;
      }
    }

    return {
      goalId: g.id,
      goalName: g.name,
      percentComplete,
      monthlyNeededCents,
      deadline: g.deadline,
      onTrack,
    };
  });

  // ── Insights ──
  const insights: SavingsInsight[] = [];

  if (savingsRatePercent < 10 && avgMonthlyIncomeCents > 0n) {
    insights.push({
      type: 'warning',
      title: 'Taux d\'épargne faible',
      description: `Votre taux d'épargne est de ${savingsRatePercent.toFixed(1)} %. L'objectif recommandé est d'au moins 10 à 20 %.`,
    });
  } else if (savingsRatePercent >= 20) {
    insights.push({
      type: 'success',
      title: 'Excellent taux d\'épargne',
      description: `Votre taux d'épargne de ${savingsRatePercent.toFixed(1)} % est au-dessus de la moyenne.`,
    });
  }

  for (const opt of accountOptimizations) {
    if (opt.currentRateBps == null || opt.currentRateBps === 0) {
      insights.push({
        type: 'warning',
        title: `Taux manquant : ${opt.accountName}`,
        description: `Renseignez le taux d'intérêt de ce compte pour un suivi précis. Le ${opt.bestRateLabel} offre ${(opt.bestRateBps / 100).toFixed(2)} %.`,
      });
    } else if (opt.annualGainCents > 100n) {
      insights.push({
        type: 'info',
        title: `Optimisation possible : ${opt.accountName}`,
        description: `En passant au taux du ${opt.bestRateLabel} (${(opt.bestRateBps / 100).toFixed(2)} %), vous pourriez gagner ~${formatCentsSimple(opt.annualGainCents)}/an.`,
      });
    }
  }

  for (const gt of goalTimelines) {
    if (gt.onTrack === false) {
      insights.push({
        type: 'warning',
        title: `Objectif en retard : ${gt.goalName}`,
        description: gt.monthlyNeededCents
          ? `Il faudrait épargner ${formatCentsSimple(gt.monthlyNeededCents)}/mois pour atteindre cet objectif à temps.`
          : 'Ajustez votre contribution mensuelle pour rester sur la bonne voie.',
      });
    } else if (gt.onTrack === true) {
      insights.push({
        type: 'success',
        title: `En bonne voie : ${gt.goalName}`,
        description: `${gt.percentComplete.toFixed(0)} % atteint — vous êtes sur la bonne trajectoire.`,
      });
    }
  }

  if (fixedChargesCents > 0n && avgMonthlyIncomeCents > 0n) {
    const fixedRatio = Number((fixedChargesCents * 100n) / avgMonthlyIncomeCents);
    if (fixedRatio > 50) {
      insights.push({
        type: 'warning',
        title: 'Charges fixes élevées',
        description: `Vos charges fixes représentent ${fixedRatio} % de vos revenus. Envisagez de réduire certains abonnements.`,
      });
    }
  }

  // ── Health score (0-100) ──
  let score = 50; // baseline
  // Savings rate contribution (0-30 pts)
  score += Math.min(30, Math.round(savingsRatePercent * 1.5));
  // Goal progress contribution (0-20 pts)
  if (goalTimelines.length > 0) {
    const avgProgress = goalTimelines.reduce((s, g) => s + g.percentComplete, 0) / goalTimelines.length;
    score += Math.min(20, Math.round(avgProgress / 5));
    // Penalty for off-track goals
    const offTrack = goalTimelines.filter((g) => g.onTrack === false).length;
    score -= offTrack * 5;
  }
  // Rate optimization (0-10 pts)
  const hasAllRates = accountsWithBalance.every((a) => a.interestRateBps != null && a.interestRateBps > 0);
  if (hasAllRates) score += 10;

  const healthScore = Math.max(0, Math.min(100, score));

  return {
    avgMonthlyIncomeCents,
    avgMonthlyExpenseCents,
    fixedChargesCents,
    savingsCapacityCents,
    savingsRatePercent,
    healthScore,
    totalEstimatedAnnualInterestCents,
    accountOptimizations,
    goalTimelines,
    insights,
  };
}

/* ═══ Helpers ═══ */

function toMonthlyCentsBigint(amountCents: bigint, freq: string): bigint {
  switch (freq) {
    case 'WEEKLY':    return (amountCents * 52n) / 12n;
    case 'QUARTERLY': return amountCents / 3n;
    case 'YEARLY':    return amountCents / 12n;
    default:          return amountCents;
  }
}

function formatCentsSimple(cents: bigint): string {
  const abs = cents < 0n ? -cents : cents;
  const euros = abs / 100n;
  return `${euros} €`;
}
