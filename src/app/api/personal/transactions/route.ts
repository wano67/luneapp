// src/app/api/personal/transactions/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import { getRequestId, withRequestId, badRequest, unauthorized } from '@/server/http/apiUtils';

type TxType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

function isTxnType(v: unknown): v is TxType {
  return v === 'INCOME' || v === 'EXPENSE' || v === 'TRANSFER';
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object';
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isNumericId(v: string) {
  return /^\d+$/.test(v);
}

function toStrId(v: bigint) {
  return v.toString();
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
  // format: `${dateISO}|${id}`
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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const { userId } = await requireAuthAsync(req);

    const url = new URL(req.url);

    const accountId = url.searchParams.get('accountId') ?? undefined;
    const limitRaw = url.searchParams.get('limit');
    const typeRaw = url.searchParams.get('type') ?? undefined;
    const q = (url.searchParams.get('q') ?? '').trim();
    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');
    const cursorRaw = url.searchParams.get('cursor');

    const limit = Math.min(200, Math.max(1, Number(limitRaw ?? 50) || 50));

    if (accountId && !isNumericId(accountId)) return withIdNoStore(badRequest('Invalid accountId'), requestId);

    const type: TxType | undefined = typeRaw ? (isTxnType(typeRaw) ? typeRaw : undefined) : undefined;
    if (typeRaw && !type) return withIdNoStore(badRequest('Invalid type'), requestId);

    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    if (fromRaw && Number.isNaN(from!.getTime())) return withIdNoStore(badRequest('Invalid from'), requestId);
    if (toRaw && Number.isNaN(to!.getTime())) return withIdNoStore(badRequest('Invalid to'), requestId);

    const cursor = cursorRaw ? parseCursor(cursorRaw) : null;
    if (cursorRaw && !cursor) return withIdNoStore(badRequest('Invalid cursor'), requestId);

    // Pagination stable: order by date desc, id desc
    const cursorWhere: Prisma.PersonalTransactionWhereInput =
      cursor
        ? {
            OR: [{ date: { lt: cursor.date } }, { date: cursor.date, id: { lt: cursor.id } }],
          }
        : {};

    const items = await prisma.personalTransaction.findMany({
      where: {
        userId: BigInt(userId),
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

    return withRequestId(
      withNoStore(
        NextResponse.json({
          items: page.map((t) => ({
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
          nextCursor,
        })
      ),
      requestId
    );
  } catch (e: unknown) {
    if (getErrorMessage(e) === 'UNAUTHORIZED') {
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
      key: `personal:tx:create:${userId}`,
      limit: 120,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return withIdNoStore(limited, requestId);

    const body: unknown = await req.json().catch(() => null);
    if (!isRecord(body)) return withIdNoStore(badRequest('Invalid JSON'), requestId);

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
    if (!isNumericId(accountIdStr)) return withIdNoStore(badRequest('Invalid accountId'), requestId);
    const accountId = BigInt(accountIdStr);

    // type
    if (!isTxnType(typeRaw)) return withIdNoStore(badRequest('Invalid type'), requestId);
    const type: TxType = typeRaw;

    // date
    const date = parseDateISO(dateRaw, 'date');

    // amountCents (BigInt)
    let amountCents: bigint;
    try {
      amountCents = parseBigIntLike(amountRaw, 'amountCents');
    } catch {
      return withIdNoStore(badRequest('Invalid amountCents'), requestId);
    }

    // label
    const label = String(labelRaw ?? '').trim();
    if (!label) return withIdNoStore(badRequest('Invalid label'), requestId);
    if (label.length > 160) return withIdNoStore(badRequest('Label too long'), requestId);

    // note
    const note =
      noteRaw === null || noteRaw === undefined ? null : String(noteRaw).trim().slice(0, 2000) || null;

    // Ensure account belongs to user
    const account = await prisma.personalAccount.findFirst({
      where: { id: accountId, userId: BigInt(userId) },
      select: { id: true, name: true, currency: true },
    });
    if (!account) return withIdNoStore(NextResponse.json({ error: 'Account not found' }, { status: 404 }), requestId);

    // category (optional) must belong to user
    let categoryId: bigint | null = null;
    if (categoryIdRaw !== null && categoryIdRaw !== undefined && String(categoryIdRaw).trim() !== '') {
      const catStr = String(categoryIdRaw).trim();
      if (!isNumericId(catStr)) return withIdNoStore(badRequest('Invalid categoryId'), requestId);
      const catId = BigInt(catStr);

      const category = await prisma.personalCategory.findFirst({
        where: { id: catId, userId: BigInt(userId) },
        select: { id: true },
      });
      if (!category)
        return withIdNoStore(NextResponse.json({ error: 'Category not found' }, { status: 404 }), requestId);

      categoryId = catId;
    }

    // currency: prefer body, else account.currency, else EUR
    const currency =
      typeof currencyRaw === 'string' && currencyRaw.trim()
        ? currencyRaw.trim()
        : account.currency || 'EUR';
    if (currency.length > 8) return withIdNoStore(badRequest('Invalid currency'), requestId);

    const created = await prisma.personalTransaction.create({
      data: {
        userId: BigInt(userId),
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

    return withRequestId(
      withNoStore(
        NextResponse.json({
          item: {
            id: toStrId(created.id),
            type: created.type,
            date: created.date.toISOString(),
            amountCents: created.amountCents.toString(),
            currency: created.currency,
            label: created.label,
            note: created.note,
            account: { id: toStrId(created.accountId), name: created.account.name },
            category: created.category
              ? { id: toStrId(created.categoryId!), name: created.category.name }
              : null,
          },
        })
      ),
      requestId
    );
  } catch (e: unknown) {
    const msg = getErrorMessage(e);

    if (msg === 'UNAUTHORIZED') {
      return withIdNoStore(unauthorized(), requestId);
    }
    if (msg.startsWith('INVALID_')) {
      return withIdNoStore(NextResponse.json({ error: 'Invalid payload' }, { status: 400 }), requestId);
    }

    console.error(e);
    return withIdNoStore(NextResponse.json({ error: 'Failed' }, { status: 500 }), requestId);
  }
}
