import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { jsonNoStore } from '@/server/security/csrf';

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> }
) {
  try {
    const { userId } = await requireAuthAsync(req);
    const { accountId } = await ctx.params;

    if (!/^\d+$/.test(accountId)) {
      return NextResponse.json({ error: 'Invalid accountId' }, { status: 400 });
    }

    const account = await prisma.personalAccount.findFirst({
      where: { id: BigInt(accountId), userId: BigInt(userId) },
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

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const now = new Date();
    const since = startOfDayUTC(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

    const [sumAll, sum30] = await Promise.all([
      prisma.personalTransaction.aggregate({
        where: { userId: BigInt(userId), accountId: BigInt(accountId) },
        _sum: { amountCents: true },
      }),
      prisma.personalTransaction.aggregate({
        where: { userId: BigInt(userId), accountId: BigInt(accountId), date: { gte: since } },
        _sum: { amountCents: true },
      }),
    ]);

    const txAll = sumAll._sum.amountCents ?? BigInt(0);
    const delta30 = sum30._sum.amountCents ?? BigInt(0);
    const balance = account.initialCents + txAll;

    return jsonNoStore({
      account: {
        id: account.id.toString(),
        name: account.name,
        type: account.type,
        currency: account.currency,
        institution: account.institution,
        iban: account.iban,
        initialCents: account.initialCents.toString(),
        balanceCents: balance.toString(),
        delta30Cents: delta30.toString(),
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      },
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
