// src/app/api/personal/accounts/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';

function toStrId(v: bigint) {
  return v.toString();
}

function parseBigIntCents(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  const s = String(value ?? '0').trim();
  if (!s) return BigInt(0);
  // accepte "-123" / "123"
  if (!/^-?\d+$/.test(s)) return BigInt(0);
  return BigInt(s);
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

    const items = accounts.map((a) => {
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

    return NextResponse.json({ items });
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

    const created = await prisma.personalAccount.create({
      data: {
        userId: BigInt(userId),
        name,
        type: body.type ?? 'CURRENT',
        currency: (body.currency ?? 'EUR').trim() || 'EUR',
        institution: body.institution?.trim() || null,
        iban: body.iban?.trim() || null,
        initialCents: parseBigIntCents(body.initialCents),
      },
      select: { id: true },
    });

    return NextResponse.json({ account: { id: toStrId(created.id) } }, { status: 201 });
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
