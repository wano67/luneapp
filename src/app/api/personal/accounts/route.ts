import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, readJson, isRecord } from '@/server/http/apiUtils';
import { rateLimit } from '@/server/security/rateLimit';
import { parseCentsInput } from '@/lib/money';

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

export const GET = withPersonalRoute(async (ctx) => {
  const accounts = await prisma.personalAccount.findMany({
    where: { userId: ctx.userId },
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

  const sumsAll = accountIds.length
    ? await prisma.personalTransaction.groupBy({
        by: ['accountId'],
        where: { userId: ctx.userId, accountId: { in: accountIds } },
        _sum: { amountCents: true },
      })
    : [];

  const allMap = new Map<bigint, bigint>();
  for (const row of sumsAll) allMap.set(row.accountId, row._sum.amountCents ?? 0n);

  const now = new Date();
  const since = startOfDayUTC(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const sums30 = accountIds.length
    ? await prisma.personalTransaction.groupBy({
        by: ['accountId'],
        where: {
          userId: ctx.userId,
          accountId: { in: accountIds },
          date: { gte: since },
        },
        _sum: { amountCents: true },
      })
    : [];

  const d30Map = new Map<bigint, bigint>();
  for (const row of sums30) d30Map.set(row.accountId, row._sum.amountCents ?? 0n);

  return jsonb(
    {
      items: accounts.map((a) => {
        const txAll = allMap.get(a.id) ?? 0n;
        const balanceCents = a.initialCents + txAll;
        const delta30Cents = d30Map.get(a.id) ?? 0n;

        return {
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          institution: a.institution,
          iban: a.iban,
          initialCents: a.initialCents,
          balanceCents,
          delta30Cents,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        };
      }),
    },
    ctx.requestId
  );
});

export const POST = withPersonalRoute(async (ctx, req) => {
  const limited = rateLimit(req, {
    key: `personal:accounts:create:${ctx.userId}`,
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Invalid JSON');

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
      : null;
  const iban = typeof body.iban === 'string' ? body.iban.trim() || null : null;
  const initialCentsRaw =
    typeof body.initialCents === 'number' || typeof body.initialCents === 'string'
      ? body.initialCents
      : '0';

  if (!name) return badRequest('name required');
  if (name.length > 120) return badRequest('name too long');
  if (currency.length > 8) return badRequest('currency too long');
  if (institution && institution.length > 120) return badRequest('institution too long');
  if (iban && iban.length > 34) return badRequest('iban too long');

  const initialParsed = parseCentsInput(initialCentsRaw);
  if (initialParsed == null || !Number.isFinite(initialParsed)) {
    return badRequest('Invalid initialCents');
  }
  const initialCents = BigInt(initialParsed);

  const created = await prisma.personalAccount.create({
    data: {
      userId: ctx.userId,
      name,
      type,
      currency,
      institution,
      iban,
      initialCents,
    },
  });

  return jsonbCreated({ item: { id: created.id, name: created.name } }, ctx.requestId);
});
