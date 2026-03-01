import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { InvoiceStatus, ProjectStatus } from '@/generated/prisma';

// GET /api/focus/summary
// Returns a cross-space (perso + pro) dashboard summary for the Focus page.
export const GET = withPersonalRoute(async (ctx) => {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const startOfNextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
  );

  // ── Personal ──────────────────────────────────────────────────────────
  const [accounts, persoAgg, incomeAgg, expenseAgg, latestTx] = await Promise.all([
    // All accounts to compute total balance
    prisma.personalAccount.findMany({
      where: { userId: ctx.userId },
      select: { id: true, initialCents: true },
    }),
    // Month net
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        date: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _sum: { amountCents: true },
    }),
    // Month income
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        date: { gte: startOfMonth, lt: startOfNextMonth },
        amountCents: { gt: 0n },
      },
      _sum: { amountCents: true },
    }),
    // Month expense
    prisma.personalTransaction.aggregate({
      where: {
        userId: ctx.userId,
        date: { gte: startOfMonth, lt: startOfNextMonth },
        amountCents: { lt: 0n },
      },
      _sum: { amountCents: true },
    }),
    // 5 latest transactions
    prisma.personalTransaction.findMany({
      where: { userId: ctx.userId },
      orderBy: { date: 'desc' },
      take: 5,
      select: {
        id: true,
        label: true,
        amountCents: true,
        date: true,
        category: { select: { name: true } },
        account: { select: { name: true } },
      },
    }),
  ]);

  // Compute total balance: sum of (initialCents + all tx) per account
  const accountIds = accounts.map((a) => a.id);
  const txSumsByAccount = accountIds.length
    ? await prisma.personalTransaction.groupBy({
        by: ['accountId'],
        where: { userId: ctx.userId, accountId: { in: accountIds } },
        _sum: { amountCents: true },
      })
    : [];

  const txSumMap = new Map<bigint, bigint>();
  for (const row of txSumsByAccount) {
    txSumMap.set(row.accountId, row._sum.amountCents ?? 0n);
  }
  const totalBalanceCents = accounts.reduce((acc, a) => {
    return acc + a.initialCents + (txSumMap.get(a.id) ?? 0n);
  }, 0n);

  const personal = {
    totalBalanceCents,
    monthNetCents: persoAgg._sum.amountCents ?? 0n,
    monthIncomeCents: incomeAgg._sum.amountCents ?? 0n,
    monthExpenseCents: expenseAgg._sum.amountCents ?? 0n,
    latestTransactions: latestTx.map((t) => ({
      id: t.id,
      label: t.label,
      amountCents: t.amountCents,
      date: t.date,
      categoryName: t.category?.name ?? null,
      accountName: t.account.name,
    })),
  };

  // ── Pro (first active business) ───────────────────────────────────────
  const membership = await prisma.businessMembership.findFirst({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'asc' },
    include: { business: { select: { id: true, name: true } } },
  });

  let pro: null | {
    businessId: bigint;
    businessName: string;
    activeProjectsCount: number;
    pendingInvoicesCount: number;
    monthRevenueCents: bigint;
    nextDueInvoice: { id: bigint; totalCents: bigint; dueAt: Date; projectName: string } | null;
  } = null;

  if (membership) {
    const businessId = membership.business.id;

    const [activeProjects, pendingInvoices, monthPayments, nextDue] = await Promise.all([
      // Active + planned + on_hold projects
      prisma.project.count({
        where: {
          businessId,
          status: { in: [ProjectStatus.ACTIVE, ProjectStatus.PLANNED, ProjectStatus.ON_HOLD] },
        },
      }),
      // Invoices sent but not paid
      prisma.invoice.count({
        where: { businessId, status: InvoiceStatus.SENT },
      }),
      // Revenue this month = payments received
      prisma.payment.aggregate({
        where: {
          businessId,
          deletedAt: null,
          paidAt: { gte: startOfMonth, lt: startOfNextMonth },
        },
        _sum: { amountCents: true },
      }),
      // Next due invoice
      prisma.invoice.findFirst({
        where: {
          businessId,
          status: InvoiceStatus.SENT,
          dueAt: { gte: now },
        },
        orderBy: { dueAt: 'asc' },
        select: {
          id: true,
          totalCents: true,
          dueAt: true,
          project: { select: { name: true } },
        },
      }),
    ]);

    pro = {
      businessId: membership.business.id,
      businessName: membership.business.name,
      activeProjectsCount: activeProjects,
      pendingInvoicesCount: pendingInvoices,
      monthRevenueCents: monthPayments._sum.amountCents ?? 0n,
      nextDueInvoice: nextDue
        ? {
            id: nextDue.id,
            totalCents: nextDue.totalCents,
            dueAt: nextDue.dueAt!,
            projectName: nextDue.project.name,
          }
        : null,
    };
  }

  return jsonb({ personal, pro }, ctx.requestId);
});
