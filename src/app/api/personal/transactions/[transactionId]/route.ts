import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, withRequestId } from '@/server/http/apiUtils';
import { withNoStore, jsonNoStore } from '@/server/security/csrf';

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

function isNumericId(s: string) {
  return /^\d+$/.test(s);
}

function parseBigIntString(v: unknown, field: string) {
  if (typeof v !== 'string' || !/^-?\d+$/.test(v)) throw new Error(`Invalid ${field}`);
  return BigInt(v);
}

function toStrId(v: bigint) {
  return v.toString();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function isTxnType(v: unknown): v is TxType {
  return v === 'INCOME' || v === 'EXPENSE' || v === 'TRANSFER';
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ transactionId: string }> }) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return withIdNoStore(csrf, requestId);

  try {
    const { userId } = await requireAuthAsync(req);
    const limited = rateLimit(req, {
      key: `personal:tx:update:${userId}`,
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return withIdNoStore(limited, requestId);
    const { transactionId } = await ctx.params;

    if (!isNumericId(transactionId)) {
      return withIdNoStore(NextResponse.json({ error: 'Invalid transactionId' }, { status: 400 }), requestId);
    }

    const body = await req.json().catch(() => null);
    if (!isRecord(body)) return withIdNoStore(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }), requestId);

    const data: Record<string, unknown> = {};

    if (body.label !== undefined) {
      const label = String(body.label ?? '').trim();
      if (!label) return withIdNoStore(NextResponse.json({ error: 'Label required' }, { status: 400 }), requestId);
      data.label = label;
    }

    if (body.note !== undefined) {
      const note = String(body.note ?? '').trim();
      data.note = note ? note : null;
    }

    if (body.currency !== undefined) {
      const currency = String(body.currency ?? '').trim().toUpperCase();
      if (!currency || currency.length > 8)
        return withIdNoStore(NextResponse.json({ error: 'Invalid currency' }, { status: 400 }), requestId);
      data.currency = currency;
    }

    if (body.date !== undefined) {
      const d = new Date(String(body.date));
      if (Number.isNaN(d.getTime())) return withIdNoStore(NextResponse.json({ error: 'Invalid date' }, { status: 400 }), requestId);
      data.date = d;
    }

    if (body.categoryId !== undefined) {
      if (body.categoryId === null || body.categoryId === '') {
        data.categoryId = null;
      } else {
        const cid = String(body.categoryId);
        if (!isNumericId(cid)) return withIdNoStore(NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 }), requestId);
        data.categoryId = BigInt(cid);
      }
    }

    if (body.accountId !== undefined) {
      const aid = String(body.accountId);
      if (!isNumericId(aid)) return withIdNoStore(NextResponse.json({ error: 'Invalid accountId' }, { status: 400 }), requestId);

      const acc = await prisma.personalAccount.findFirst({
        where: { id: BigInt(aid), userId: BigInt(userId) },
        select: { id: true },
      });
      if (!acc) return withIdNoStore(NextResponse.json({ error: 'Account not found' }, { status: 404 }), requestId);

      data.accountId = BigInt(aid);
    }

    let amount: bigint | null = null;
    let type: TxType | null = null;

    if (body.amountCents !== undefined) amount = parseBigIntString(body.amountCents, 'amountCents');
    if (body.type !== undefined && isTxnType(body.type)) type = body.type;

    if (amount !== null || type !== null) {
      const existing = await prisma.personalTransaction.findFirst({
        where: { id: BigInt(transactionId), userId: BigInt(userId) },
        select: { amountCents: true, type: true },
      });
      if (!existing) return withIdNoStore(NextResponse.json({ error: 'Transaction not found' }, { status: 404 }), requestId);

      const finalType: TxType = type ?? existing.type;
      let finalAmount = amount ?? existing.amountCents;

      if (finalAmount === BigInt(0)) {
        return withIdNoStore(NextResponse.json({ error: 'Zero amount not allowed' }, { status: 400 }), requestId);
      }

      if (finalType === 'EXPENSE' && finalAmount > BigInt(0)) finalAmount = -finalAmount;
      if (finalType === 'INCOME' && finalAmount < BigInt(0)) finalAmount = -finalAmount;

      data.type = finalType;
      data.amountCents = finalAmount;
    }

    const updated = await prisma.personalTransaction.updateMany({
      where: { id: BigInt(transactionId), userId: BigInt(userId) },
      data,
    });

    if (updated.count === 0) {
      return withIdNoStore(NextResponse.json({ error: 'Transaction not found' }, { status: 404 }), requestId);
    }

    const t = await prisma.personalTransaction.findFirst({
      where: { id: BigInt(transactionId), userId: BigInt(userId) },
      include: { account: true, category: true },
    });

    return withIdNoStore(
      jsonNoStore({
        item: t
          ? {
              id: toStrId(t.id),
              type: t.type,
              date: t.date.toISOString(),
              amountCents: t.amountCents.toString(),
              currency: t.currency,
              label: t.label,
              note: t.note,
              account: { id: toStrId(t.accountId), name: t.account.name },
              category: t.category ? { id: toStrId(t.categoryId!), name: t.category.name } : null,
            }
          : null,
      }),
      requestId
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withIdNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId);
    }
    return withIdNoStore(NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 500 }), requestId);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ transactionId: string }> }) {
  const requestId = getRequestId(req);
  const csrf = assertSameOrigin(req);
  if (csrf) return withIdNoStore(csrf, requestId);

  try {
    const { userId } = await requireAuthAsync(req);
    const limited = rateLimit(req, {
      key: `personal:tx:delete:${userId}`,
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return withIdNoStore(limited, requestId);
    const { transactionId } = await ctx.params;

    if (!isNumericId(transactionId)) {
      return withIdNoStore(NextResponse.json({ error: 'Invalid transactionId' }, { status: 400 }), requestId);
    }

    const del = await prisma.personalTransaction.deleteMany({
      where: { id: BigInt(transactionId), userId: BigInt(userId) },
    });

    if (del.count === 0) return withIdNoStore(NextResponse.json({ error: 'Not found' }, { status: 404 }), requestId);

    return withIdNoStore(jsonNoStore({ deleted: del.count }), requestId);
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return withIdNoStore(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), requestId);
    }
    return withIdNoStore(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}
