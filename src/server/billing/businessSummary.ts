import { prisma } from '@/server/db/client';
import { FinanceType, InvoiceStatus, ProjectStatus, QuoteStatus } from '@/generated/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BusinessBillingSummary = {
  totalInvoicedCents: bigint;
  totalPaidCents: bigint;
  pendingCollectionCents: bigint;
  totalPlannedCents: bigint;
};

export type BusinessProjectMetrics = {
  avgProfitabilityPercent: number;
  avgDurationDays: number;
  completedProjectsCount: number;
};

// ---------------------------------------------------------------------------
// Billing summary — bulk queries, no N+1
// ---------------------------------------------------------------------------

export async function computeBusinessBillingSummary(
  businessId: bigint
): Promise<BusinessBillingSummary> {
  const [invoiceAgg, paymentAgg, quoteAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: { businessId, status: { not: InvoiceStatus.CANCELLED } },
      _sum: { totalCents: true },
    }),
    prisma.payment.aggregate({
      where: { businessId, deletedAt: null },
      _sum: { amountCents: true },
    }),
    prisma.quote.aggregate({
      where: { businessId, status: QuoteStatus.SIGNED },
      _sum: { totalCents: true },
    }),
  ]);

  const totalInvoicedCents = invoiceAgg._sum.totalCents ?? BigInt(0);
  const totalPaidCents = paymentAgg._sum.amountCents ?? BigInt(0);
  const totalPlannedCents = quoteAgg._sum.totalCents ?? BigInt(0);
  const pendingCollectionCents =
    totalInvoicedCents > totalPaidCents
      ? totalInvoicedCents - totalPaidCents
      : BigInt(0);

  return {
    totalInvoicedCents,
    totalPaidCents,
    pendingCollectionCents,
    totalPlannedCents,
  };
}

// ---------------------------------------------------------------------------
// Project performance metrics
// ---------------------------------------------------------------------------

export async function computeBusinessProjectMetrics(
  businessId: bigint
): Promise<BusinessProjectMetrics> {
  const completedProjects = await prisma.project.findMany({
    where: { businessId, status: ProjectStatus.COMPLETED },
    select: {
      id: true,
      startDate: true,
      startedAt: true,
      updatedAt: true,
      billingQuoteId: true,
    },
  });

  if (completedProjects.length === 0) {
    return { avgProfitabilityPercent: 0, avgDurationDays: 0, completedProjectsCount: 0 };
  }

  // Duration: average (updatedAt - startDate) in days for completed projects
  let totalDurationDays = 0;
  let durationCount = 0;
  for (const p of completedProjects) {
    const start = p.startDate ?? p.startedAt;
    if (!start) continue;
    const end = p.updatedAt; // proxy for completedAt
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (days > 0) {
      totalDurationDays += days;
      durationCount += 1;
    }
  }

  // Profitability: real margin = (revenue - costs) / revenue × 100
  const projectIds = completedProjects.map((p) => p.id);

  let avgProfitabilityPercent = 0;
  if (projectIds.length > 0) {
    const [paymentAgg, expenseAgg] = await Promise.all([
      // Revenue = payments received
      prisma.payment.aggregate({
        where: { businessId, deletedAt: null, projectId: { in: projectIds } },
        _sum: { amountCents: true },
      }),
      // Costs = direct expenses (Finance EXPENSE)
      prisma.finance.aggregate({
        where: { businessId, projectId: { in: projectIds }, type: FinanceType.EXPENSE, deletedAt: null },
        _sum: { amountCents: true },
      }),
    ]);

    const revenue = paymentAgg._sum.amountCents ?? 0n;
    const costs = expenseAgg._sum.amountCents ?? 0n;
    const absCosts = costs < 0n ? -costs : costs;
    if (revenue > 0n) {
      avgProfitabilityPercent = Math.round(Number((revenue - absCosts) * 100n / revenue));
    }
  }

  return {
    avgProfitabilityPercent,
    avgDurationDays: durationCount > 0 ? Math.round(totalDurationDays / durationCount) : 0,
    completedProjectsCount: completedProjects.length,
  };
}
