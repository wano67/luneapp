import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';

function toStrId(v: bigint) {
  return v.toString();
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuthAsync(req);

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

    // Somme de toutes les transactions par compte (pour le solde)
    const sumsAll = accountIds.length
      ? await prisma.personalTransaction.groupBy({
          by: ['accountId'],
          where: { userId: BigInt(userId), accountId: { in: accountIds } },
          _sum: { amountCents: true },
        })
      : [];

    const allMap = new Map<string, bigint>();
    for (const row of sumsAll) allMap.set(toStrId(row.accountId), row._sum.amountCents ?? BigInt(0));

    // Somme des transactions sur 30 jours glissants
    const now = new Date();
    const since = startOfDayUTC(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

    const sums30 = accountIds.length
      ? await prisma.personalTransaction.groupBy({
          by: ['accountId'],
          where: {
            userId: BigInt(userId),
            accountId: { in: accountIds },
            date: { gte: since },
          },
          _sum: { amountCents: true },
        })
      : [];

    const d30Map = new Map<string, bigint>();
    for (const row of sums30) d30Map.set(toStrId(row.accountId), row._sum.amountCents ?? BigInt(0));

    return NextResponse.json({
      items: accounts.map((a) => {
        const txAll = allMap.get(toStrId(a.id)) ?? BigInt(0);
        const balanceCents = a.initialCents + txAll;
        const delta30Cents = d30Map.get(toStrId(a.id)) ?? BigInt(0);

        return {
          id: toStrId(a.id),
          name: a.name,
          type: a.type,
          currency: a.currency,
          institution: a.institution,
          iban: a.iban,
          initialCents: a.initialCents.toString(),
          balanceCents: balanceCents.toString(),
          delta30Cents: delta30Cents.toString(),
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        };
      }),
    });
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuthAsync(req);

    const body = (await req.json()) as {
      name?: string;
      type?: 'CURRENT' | 'SAVINGS' | 'INVEST' | 'CASH';
      currency?: string;
      institution?: string | null;
      iban?: string | null;
      initialCents?: string | number;
    };

    const name = (body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const initialCents = BigInt(
      typeof body.initialCents === 'number'
        ? Math.trunc(body.initialCents)
        : (body.initialCents ?? '0').toString().trim() || '0'
    );

    const created = await prisma.personalAccount.create({
      data: {
        userId: BigInt(userId),
        name,
        type: body.type ?? 'CURRENT',
        currency: (body.currency ?? 'EUR').trim() || 'EUR',
        institution: body.institution ?? null,
        iban: body.iban ?? null,
        initialCents,
      },
    });

    return NextResponse.json(
      { account: { id: created.id.toString(), name: created.name } },
      { status: 201 }
    );
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
