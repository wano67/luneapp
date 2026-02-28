import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
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

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> }
) {
  const requestId = getRequestId(req);
  try {
    const { userId } = await requireAuthAsync(req);
    const { accountId } = await ctx.params;

    if (!/^\d+$/.test(accountId)) {
      return withRequestId(NextResponse.json({ error: 'Invalid accountId' }, { status: 400 }), requestId);
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
      return withRequestId(NextResponse.json({ error: 'Account not found' }, { status: 404 }), requestId);
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

    return withRequestId(
      jsonNoStore({
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
      }),
      requestId
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withRequestId(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId);
    }
    console.error(e);
    return withRequestId(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> }
) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return withIdNoStore(csrf, requestId);

  try {
    const { userId } = await requireAuthAsync(req);
    const { accountId } = await ctx.params;

    if (!/^\d+$/.test(accountId)) {
      return withIdNoStore(NextResponse.json({ error: 'Invalid accountId' }, { status: 400 }), requestId);
    }

    const body = await readJson(req);
    if (!isRecord(body)) {
      return withIdNoStore(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }), requestId);
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const type =
      body.type === 'CURRENT' || body.type === 'SAVINGS' || body.type === 'INVEST' || body.type === 'CASH'
        ? body.type
        : null;
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
        : null;

    if (!name) return withIdNoStore(NextResponse.json({ error: 'name required' }, { status: 400 }), requestId);
    if (name.length > 120) {
      return withIdNoStore(NextResponse.json({ error: 'name too long' }, { status: 400 }), requestId);
    }
    if (!type) {
      return withIdNoStore(NextResponse.json({ error: 'type invalid' }, { status: 400 }), requestId);
    }
    if (institution && institution.length > 120) {
      return withIdNoStore(NextResponse.json({ error: 'institution too long' }, { status: 400 }), requestId);
    }
    if (iban && iban.length > 34) {
      return withIdNoStore(NextResponse.json({ error: 'iban too long' }, { status: 400 }), requestId);
    }
    if (initialCentsRaw === null) {
      return withIdNoStore(NextResponse.json({ error: 'initialCents required' }, { status: 400 }), requestId);
    }

    let initialCents: bigint;
    try {
      initialCents = BigInt(
        typeof initialCentsRaw === 'number'
          ? Math.trunc(initialCentsRaw)
          : (initialCentsRaw ?? '0').toString().trim() || '0'
      );
    } catch {
      return withIdNoStore(NextResponse.json({ error: 'initialCents invalid' }, { status: 400 }), requestId);
    }

    const account = await prisma.personalAccount.findFirst({
      where: { id: BigInt(accountId), userId: BigInt(userId) },
      select: { id: true },
    });

    if (!account) {
      return withIdNoStore(NextResponse.json({ error: 'Account not found' }, { status: 404 }), requestId);
    }

    const updated = await prisma.personalAccount.update({
      where: { id: BigInt(accountId) },
      data: { name, type, institution, iban, initialCents },
    });

    return withRequestId(
      jsonNoStore({ account: { id: updated.id.toString(), name: updated.name } }),
      requestId
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withIdNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId);
    }
    console.error(e);
    return withIdNoStore(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ accountId: string }> }
) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return withIdNoStore(csrf, requestId);

  try {
    const { userId } = await requireAuthAsync(req);
    const { accountId } = await ctx.params;

    if (!/^\d+$/.test(accountId)) {
      return withIdNoStore(NextResponse.json({ error: 'Invalid accountId' }, { status: 400 }), requestId);
    }

    const account = await prisma.personalAccount.findFirst({
      where: { id: BigInt(accountId), userId: BigInt(userId) },
      select: { id: true },
    });

    if (!account) {
      return withIdNoStore(NextResponse.json({ error: 'Account not found' }, { status: 404 }), requestId);
    }

    await prisma.personalAccount.delete({ where: { id: BigInt(accountId) } });

    return withRequestId(jsonNoStore({ ok: true }), requestId);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withIdNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId);
    }
    console.error(e);
    return withIdNoStore(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}
