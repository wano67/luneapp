import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

function isTxnType(v: unknown): v is TxType {
  return v === 'INCOME' || v === 'EXPENSE' || v === 'TRANSFER';
}

function isNumericId(v: string) {
  return /^\d+$/.test(v);
}

function parseBigIntLike(v: unknown, field: string): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error(`INVALID_${field}`);
    }
    return BigInt(v);
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^-?\d+$/.test(s)) throw new Error(`INVALID_${field}`);
    return BigInt(s);
  }
  throw new Error(`INVALID_${field}`);
}

function parseDateISO(v: unknown, field: string): Date {
  if (typeof v !== 'string') throw new Error(`INVALID_${field}`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`INVALID_${field}`);
  return d;
}

function parseCursor(cursor: string): { date: Date; id: bigint } | null {
  const [dateStr, idStr] = cursor.split('|');
  if (!dateStr || !idStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  if (!/^\d+$/.test(idStr)) return null;
  return { date: d, id: BigInt(idStr) };
}

function makeCursor(t: { date: Date; id: bigint }) {
  return `${t.date.toISOString()}|${t.id.toString()}`;
}

export const GET = withPersonalRoute(async (ctx, req) => {
  const url = new URL(req.url);

  const accountId = url.searchParams.get('accountId') ?? undefined;
  const limitRaw = url.searchParams.get('limit');
  const typeRaw = url.searchParams.get('type') ?? undefined;
  const q = (url.searchParams.get('q') ?? '').trim();
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  const cursorRaw = url.searchParams.get('cursor');

  const limit = Math.min(200, Math.max(1, Number(limitRaw ?? 50) || 50));

  if (accountId && !isNumericId(accountId)) return badRequest('Invalid accountId');

  const type: TxType | undefined = typeRaw ? (isTxnType(typeRaw) ? typeRaw : undefined) : undefined;
  if (typeRaw && !type) return badRequest('Invalid type');

  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;
  if (fromRaw && Number.isNaN(from!.getTime())) return badRequest('Invalid from');
  if (toRaw && Number.isNaN(to!.getTime())) return badRequest('Invalid to');

  const cursor = cursorRaw ? parseCursor(cursorRaw) : null;
  if (cursorRaw && !cursor) return badRequest('Invalid cursor');

  const cursorWhere: Prisma.PersonalTransactionWhereInput =
    cursor
      ? {
          OR: [{ date: { lt: cursor.date } }, { date: cursor.date, id: { lt: cursor.id } }],
        }
      : {};

  const items = await prisma.personalTransaction.findMany({
    where: {
      userId: ctx.userId,
      ...(accountId ? { accountId: BigInt(accountId) } : {}),
      ...(type ? { type } : {}),
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(q
        ? {
            OR: [
              { label: { contains: q, mode: 'insensitive' } },
              { note: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...cursorWhere,
    },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { account: true, category: true },
  });

  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  const nextCursor =
    hasMore && page.length
      ? makeCursor({ date: page[page.length - 1].date, id: page[page.length - 1].id })
      : null;

  return jsonb(
    {
      items: page.map((t) => ({
        id: t.id,
        type: t.type,
        date: t.date,
        amountCents: t.amountCents,
        currency: t.currency,
        label: t.label,
        note: t.note,
        account: { id: t.accountId, name: t.account.name },
        category: t.category ? { id: t.categoryId, name: t.category.name } : null,
      })),
      nextCursor,
    },
    ctx.requestId
  );
});

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:tx:create:${ctx.userId}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Invalid JSON');

  const accountIdRaw = body.accountId;
  const categoryIdRaw = body.categoryId;
  const typeRaw = body.type;
  const dateRaw = body.date;
  const amountRaw = body.amountCents;
  const currencyRaw = body.currency;
  const labelRaw = body.label;
  const noteRaw = body.note;

  // accountId
  const accountIdStr = String(accountIdRaw ?? '').trim();
  if (!isNumericId(accountIdStr)) return badRequest('Invalid accountId');
  const accountId = BigInt(accountIdStr);

  // type
  if (!isTxnType(typeRaw)) return badRequest('Invalid type');
  const type: TxType = typeRaw;

  // date
  const date = parseDateISO(dateRaw, 'date');

  // amountCents (BigInt)
  let amountCents: bigint;
  try {
    amountCents = parseBigIntLike(amountRaw, 'amountCents');
  } catch {
    return badRequest('Invalid amountCents');
  }

  // label
  const label = String(labelRaw ?? '').trim();
  if (!label) return badRequest('Invalid label');
  if (label.length > 160) return badRequest('Label too long');

  // note
  const note =
    noteRaw === null || noteRaw === undefined ? null : String(noteRaw).trim().slice(0, 2000) || null;

  // Ensure account belongs to user
  const account = await prisma.personalAccount.findFirst({
    where: { id: accountId, userId: ctx.userId },
    select: { id: true, name: true, currency: true },
  });
  if (!account) return notFound('Account not found');

  // category (optional) must belong to user
  let categoryId: bigint | null = null;
  if (categoryIdRaw !== null && categoryIdRaw !== undefined && String(categoryIdRaw).trim() !== '') {
    const catStr = String(categoryIdRaw).trim();
    if (!isNumericId(catStr)) return badRequest('Invalid categoryId');
    const catId = BigInt(catStr);

    const category = await prisma.personalCategory.findFirst({
      where: { id: catId, userId: ctx.userId },
      select: { id: true },
    });
    if (!category) return notFound('Category not found');

    categoryId = catId;
  }

  // currency: prefer body, else account.currency, else EUR
  const currency =
    typeof currencyRaw === 'string' && currencyRaw.trim()
      ? currencyRaw.trim()
      : account.currency || 'EUR';
  if (currency.length > 8) return badRequest('Invalid currency');

  const created = await prisma.personalTransaction.create({
    data: {
      userId: ctx.userId,
      accountId,
      categoryId,
      type,
      date,
      amountCents,
      currency,
      label,
      note,
    },
    include: { account: true, category: true },
  });

  return jsonbCreated(
    {
      item: {
        id: created.id,
        type: created.type,
        date: created.date,
        amountCents: created.amountCents,
        currency: created.currency,
        label: created.label,
        note: created.note,
        account: { id: created.accountId, name: created.account.name },
        category: created.category
          ? { id: created.categoryId, name: created.category.name }
          : null,
      },
    },
    ctx.requestId
  );
});
