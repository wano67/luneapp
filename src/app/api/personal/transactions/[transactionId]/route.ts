import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';
import { rateLimit } from '@/server/security/rateLimit';

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

function isTxnType(v: unknown): v is TxType {
  return v === 'INCOME' || v === 'EXPENSE' || v === 'TRANSFER';
}

function isNumericId(s: string) {
  return /^\d+$/.test(s);
}

function parseBigIntString(v: unknown, field: string) {
  if (typeof v !== 'string' || !/^-?\d+$/.test(v)) throw new Error(`Invalid ${field}`);
  return BigInt(v);
}

function getTransactionIdFromUrl(req: Request): bigint {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  // URL: /api/personal/transactions/[transactionId]
  const transactionIdStr = segments[segments.length - 1];
  return parseId(transactionIdStr);
}

export const PATCH = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:tx:update:${ctx.userId}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const transactionId = getTransactionIdFromUrl(req);

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Invalid JSON');

  const data: Record<string, unknown> = {};

  if (body.label !== undefined) {
    const label = String(body.label ?? '').trim();
    if (!label) return badRequest('Label required');
    data.label = label;
  }

  if (body.note !== undefined) {
    const note = String(body.note ?? '').trim();
    data.note = note ? note : null;
  }

  if (body.currency !== undefined) {
    const currency = String(body.currency ?? '').trim().toUpperCase();
    if (!currency || currency.length > 8) return badRequest('Invalid currency');
    data.currency = currency;
  }

  if (body.date !== undefined) {
    const d = new Date(String(body.date));
    if (Number.isNaN(d.getTime())) return badRequest('Invalid date');
    data.date = d;
  }

  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === '') {
      data.categoryId = null;
    } else {
      const cid = String(body.categoryId);
      if (!isNumericId(cid)) return badRequest('Invalid categoryId');
      data.categoryId = BigInt(cid);
    }
  }

  if (body.accountId !== undefined) {
    const aid = String(body.accountId);
    if (!isNumericId(aid)) return badRequest('Invalid accountId');

    const acc = await prisma.personalAccount.findFirst({
      where: { id: BigInt(aid), userId: ctx.userId },
      select: { id: true },
    });
    if (!acc) return notFound('Account not found');

    data.accountId = BigInt(aid);
  }

  let amount: bigint | null = null;
  let type: TxType | null = null;

  if (body.amountCents !== undefined) amount = parseBigIntString(body.amountCents, 'amountCents');
  if (body.type !== undefined && isTxnType(body.type)) type = body.type;

  if (amount !== null || type !== null) {
    const existing = await prisma.personalTransaction.findFirst({
      where: { id: transactionId, userId: ctx.userId },
      select: { amountCents: true, type: true },
    });
    if (!existing) return notFound('Transaction not found');

    const finalType: TxType = type ?? existing.type;
    let finalAmount = amount ?? existing.amountCents;

    if (finalAmount === 0n) return badRequest('Zero amount not allowed');

    if (finalType === 'EXPENSE' && finalAmount > 0n) finalAmount = -finalAmount;
    if (finalType === 'INCOME' && finalAmount < 0n) finalAmount = -finalAmount;

    data.type = finalType;
    data.amountCents = finalAmount;
  }

  const updated = await prisma.personalTransaction.updateMany({
    where: { id: transactionId, userId: ctx.userId },
    data,
  });

  if (updated.count === 0) return notFound('Transaction not found');

  const t = await prisma.personalTransaction.findFirst({
    where: { id: transactionId, userId: ctx.userId },
    include: { account: true, category: true },
  });

  return jsonb(
    {
      item: t
        ? {
            id: t.id,
            type: t.type,
            date: t.date,
            amountCents: t.amountCents,
            currency: t.currency,
            label: t.label,
            note: t.note,
            account: { id: t.accountId, name: t.account.name },
            category: t.category ? { id: t.categoryId, name: t.category.name } : null,
          }
        : null,
    },
    ctx.requestId
  );
});

export const DELETE = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:tx:delete:${ctx.userId}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const transactionId = getTransactionIdFromUrl(req);

  const del = await prisma.personalTransaction.deleteMany({
    where: { id: transactionId, userId: ctx.userId },
  });

  if (del.count === 0) return notFound();

  return jsonbNoContent(ctx.requestId);
});
