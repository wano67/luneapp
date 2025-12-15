// src/app/api/personal/transactions/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthAsync } from '@/server/auth/requireAuth';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';

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

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await requireAuthAsync(req);

    const url = new URL(req.url);

    const accountId = url.searchParams.get('accountId') ?? undefined;
    const limitRaw = url.searchParams.get('limit');
    const type = url.searchParams.get('type') ?? undefined;
    const q = (url.searchParams.get('q') ?? '').trim();
    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');
    const cursorRaw = url.searchParams.get('cursor');

    const limit = Math.min(200, Math.max(1, Number(limitRaw ?? 50) || 50));

    if (accountId && !isNumericId(accountId)) return badRequest('Invalid accountId');

    // type validation (enum Prisma)
    if (type && !['INCOME', 'EXPENSE', 'TRANSFER'].includes(type)) {
      return badRequest('Invalid type');
    }

    const from = fromRaw ? new Date(fromRaw) : undefined;
    const to = toRaw ? new Date(toRaw) : undefined;
    if (fromRaw && Number.isNaN(from!.getTime())) return badRequest('Invalid from');
    if (toRaw && Number.isNaN(to!.getTime())) return badRequest('Invalid to');

    const cursor = cursorRaw ? parseCursor(cursorRaw) : null;
    if (cursorRaw && !cursor) return badRequest('Invalid cursor');

    // Pagination stable: order by date desc, id desc
    // Cursor: items strictly "before" (date,id)
    const cursorWhere =
      cursor
        ? {
            OR: [
              { date: { lt: cursor.date } },
              { date: cursor.date, id: { lt: cursor.id } },
            ],
          }
        : {};

    const items = await prisma.personalTransaction.findMany({
      where: {
        userId: BigInt(userId),
        ...(accountId ? { accountId: BigInt(accountId) } : {}),
        ...(type ? { type: type as any } : {}),
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...(q
          ? {
              OR: [
                { label: { contains: q, mode: 'insensitive' } },
                { note: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(cursorWhere as any),
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      take: limit + 1, // +1 pour savoir s'il y a une page suivante
      include: { account: true, category: true },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    const nextCursor = hasMore
      ? makeCursor({ date: page[page.length - 1].date, id: page[page.length - 1].id })
      : null;

    return withNoStore(
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
    );
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const { userId } = await requireAuthAsync(req);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid JSON');

    const accountIdRaw = (body as any).accountId;
    const categoryIdRaw = (body as any).categoryId;
    const typeRaw = (body as any).type;
    const dateRaw = (body as any).date;
    const amountRaw = (body as any).amountCents;
    const currencyRaw = (body as any).currency;
    const labelRaw = (body as any).label;
    const noteRaw = (body as any).note;

    // accountId
    const accountIdStr = String(accountIdRaw ?? '').trim();
    if (!isNumericId(accountIdStr)) return badRequest('Invalid accountId');
    const accountId = BigInt(accountIdStr);

    // type
    if (!['INCOME', 'EXPENSE', 'TRANSFER'].includes(String(typeRaw))) {
      return badRequest('Invalid type');
    }
    const type = String(typeRaw) as any;

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
      noteRaw === null || noteRaw === undefined
        ? null
        : String(noteRaw).trim().slice(0, 2000) || null;

    // Ensure account belongs to user
    const account = await prisma.personalAccount.findFirst({
      where: { id: accountId, userId: BigInt(userId) },
      select: { id: true, name: true, currency: true },
    });
    if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

    // category (optional) must belong to user
    let categoryId: bigint | null = null;
    if (categoryIdRaw !== null && categoryIdRaw !== undefined && String(categoryIdRaw).trim() !== '') {
      const catStr = String(categoryIdRaw).trim();
      if (!isNumericId(catStr)) return badRequest('Invalid categoryId');
      const catId = BigInt(catStr);

      const category = await prisma.personalCategory.findFirst({
        where: { id: catId, userId: BigInt(userId) },
        select: { id: true },
      });
      if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

      categoryId = catId;
    }

    // currency: prefer body, else account.currency, else EUR
    const currency = (typeof currencyRaw === 'string' && currencyRaw.trim()) ? currencyRaw.trim() : (account.currency || 'EUR');
    if (currency.length > 8) return badRequest('Invalid currency');

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

    return NextResponse.json({
      item: {
        id: toStrId(created.id),
        type: created.type,
        date: created.date.toISOString(),
        amountCents: created.amountCents.toString(),
        currency: created.currency,
        label: created.label,
        note: created.note,
        account: { id: toStrId(created.accountId), name: created.account.name },
        category: created.category ? { id: toStrId(created.categoryId!), name: created.category.name } : null,
      },
    });
  } catch (e: any) {
    if (String(e?.message) === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // erreurs de parsing spécifiques
    if (String(e?.message || '').startsWith('INVALID_')) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
