// src/app/api/personal/summary/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';

function toStrId(v: bigint) {
  return v.toString();
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuthAsync(req);


    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
    const startOfNextMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0)
    );

    // 1) Accounts
    const accounts = await prisma.personalAccount.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        type: true,
        currency: true,
        institution: true,
        iban: true,
        initialCents: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const accountIds = accounts.map((a) => a.id);

    // 2) Sum transactions by account
    const sumsByAccount = accountIds.length
      ? await prisma.personalTransaction.groupBy({
          by: ['accountId'],
          where: {
            userId: BigInt(userId),
            accountId: { in: accountIds },
          },
          _sum: { amountCents: true },
        })
      : [];

    const sumMap = new Map<string, bigint>();
    for (const row of sumsByAccount) {
      sumMap.set(toStrId(row.accountId), row._sum.amountCents ?? BigInt(0));
    }

    const accountsWithBalance = accounts.map((a) => {
      const txSum = sumMap.get(toStrId(a.id)) ?? BigInt(0);
      const balanceCents = a.initialCents + txSum;

      return {
        id: toStrId(a.id),
        name: a.name,
        type: a.type,
        currency: a.currency,
        institution: a.institution,
        iban: a.iban,
        initialCents: a.initialCents.toString(),
        balanceCents: balanceCents.toString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      };
    });

    const totalBalanceCents = accountsWithBalance.reduce(
      (acc, a) => acc + BigInt(a.balanceCents),
      BigInt(0)
    );

    // 3) Month income/expense
    const monthAgg = await prisma.personalTransaction.aggregate({
      where: {
        userId: BigInt(userId),
        date: { gte: startOfMonth, lt: startOfNextMonth },
      },
      _sum: { amountCents: true },
    });

    // On veut aussi séparer revenus/dépenses
    const [incomeAgg, expenseAgg] = await Promise.all([
      prisma.personalTransaction.aggregate({
        where: {
          userId: BigInt(userId),
          date: { gte: startOfMonth, lt: startOfNextMonth },
          amountCents: { gt: BigInt(0) },
        },
        _sum: { amountCents: true },
      }),
      prisma.personalTransaction.aggregate({
        where: {
          userId: BigInt(userId),
          date: { gte: startOfMonth, lt: startOfNextMonth },
          amountCents: { lt: BigInt(0) },
        },
        _sum: { amountCents: true },
      }),
    ]);

    const monthNetCents = monthAgg._sum.amountCents ?? BigInt(0);
    const monthIncomeCents = incomeAgg._sum.amountCents ?? BigInt(0);
    const monthExpenseCents = expenseAgg._sum.amountCents ?? BigInt(0); // négatif

    // 4) Latest transactions
    const latest = await prisma.personalTransaction.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { date: 'desc' },
      take: 12,
      include: { account: true, category: true },
    });

    return NextResponse.json({
      kpis: {
        totalBalanceCents: totalBalanceCents.toString(),
        monthNetCents: monthNetCents.toString(),
        monthIncomeCents: monthIncomeCents.toString(),
        monthExpenseCents: monthExpenseCents.toString(),
      },
      accounts: accountsWithBalance,
      latestTransactions: latest.map((t) => ({
        id: toStrId(t.id),
        type: t.type,
        date: t.date.toISOString(),
        amountCents: t.amountCents.toString(),
        currency: t.currency,
        label: t.label,
        note: t.note,
        account: { id: toStrId(t.accountId), name: t.account.name },
        category: t.category ? { id: toStrId(t.categoryId!), name: t.category.name } : null,
      })),
    });
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
