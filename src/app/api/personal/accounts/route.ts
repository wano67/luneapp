import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, withRequestId, badRequest, unauthorized } from '@/server/http/apiUtils';

function toStrId(v: bigint) {
  return v.toString();
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
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

    return withRequestId(
      jsonNoStore({
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
      }),
      requestId
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withIdNoStore(unauthorized(), requestId);
    }
    console.error(e);
    return withIdNoStore(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return withIdNoStore(csrf, requestId);

  try {
    const { userId } = await requireAuthAsync(req);
    const limited = rateLimit(req, {
      key: `personal:accounts:create:${userId}`,
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return withIdNoStore(limited, requestId);

    const body = await readJson(req);
    if (!isRecord(body)) return withIdNoStore(badRequest('Invalid JSON'), requestId);

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type =
      body.type === 'CURRENT' || body.type === 'SAVINGS' || body.type === 'INVEST' || body.type === 'CASH'
        ? body.type
        : 'CURRENT';
    const currencyRaw = typeof body.currency === 'string' ? body.currency.trim() : '';
    const currency = (currencyRaw || 'EUR').toUpperCase();
    const institution =
      typeof body.institution === 'string'
        ? body.institution.trim() || null
        : body.institution === null
        ? null
        : null;
    const iban = typeof body.iban === 'string' ? body.iban.trim() || null : null;
    const initialCentsRaw =
      typeof body.initialCents === 'number' || typeof body.initialCents === 'string'
        ? body.initialCents
        : '0';

    if (!name) return withIdNoStore(badRequest('name required'), requestId);
    if (name.length > 120) return withIdNoStore(badRequest('name too long'), requestId);
    if (currency.length > 8) return withIdNoStore(badRequest('currency too long'), requestId);
    if (institution && institution.length > 120) {
      return withIdNoStore(badRequest('institution too long'), requestId);
    }
    if (iban && iban.length > 34) {
      return withIdNoStore(badRequest('iban too long'), requestId);
    }

    const initialCents = BigInt(
      typeof initialCentsRaw === 'number'
        ? Math.trunc(initialCentsRaw)
        : (initialCentsRaw ?? '0').toString().trim() || '0'
    );

    const created = await prisma.personalAccount.create({
      data: {
        userId: BigInt(userId),
        name,
        type,
        currency,
        institution,
        iban,
        initialCents,
      },
    });

    return withRequestId(
      jsonNoStore({ account: { id: created.id.toString(), name: created.name } }, { status: 201 }),
      requestId
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withIdNoStore(unauthorized(), requestId);
    }
    console.error(e);
    return withIdNoStore(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}
