import { prisma } from '@/server/db/client';
import { withPersonalRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, readJson, isRecord } from '@/server/http/apiUtils';
import { parseId } from '@/server/http/parsers';

function startOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function getAccountIdFromUrl(req: Request): bigint {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  // URL: /api/personal/accounts/[accountId]
  const accountIdStr = segments[segments.length - 1];
  return parseId(accountIdStr);
}

export const GET = withPersonalRoute(async (ctx, req) => {
  const accountId = getAccountIdFromUrl(req);

  const account = await prisma.personalAccount.findFirst({
    where: { id: accountId, userId: ctx.userId },
    select: {
      id: true,
      name: true,
      type: true,
      currency: true,
      institution: true,
      iban: true,
      initialCents: true,
      bankCode: true,
      productCode: true,
      interestRateBps: true,
      loanPrincipalCents: true,
      loanDurationMonths: true,
      loanStartDate: true,
      hidden: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!account) return notFound('Account not found');

  const now = new Date();
  const since = startOfDayUTC(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));

  const [sumAll, sum30] = await Promise.all([
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, accountId },
      _sum: { amountCents: true },
    }),
    prisma.personalTransaction.aggregate({
      where: { userId: ctx.userId, accountId, date: { gte: since } },
      _sum: { amountCents: true },
    }),
  ]);

  const txAll = sumAll._sum.amountCents ?? 0n;
  const delta30 = sum30._sum.amountCents ?? 0n;
  const balance = account.initialCents + txAll;

  return jsonb(
    {
      account: {
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        institution: account.institution,
        iban: account.iban,
        initialCents: account.initialCents,
        bankCode: account.bankCode,
        productCode: account.productCode,
        interestRateBps: account.interestRateBps,
        loanPrincipalCents: account.loanPrincipalCents,
        loanDurationMonths: account.loanDurationMonths,
        loanStartDate: account.loanStartDate,
        hidden: account.hidden,
        balanceCents: balance,
        delta30Cents: delta30,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      },
    },
    ctx.requestId
  );
});

export const PATCH = withPersonalRoute(async (ctx, req) => {
  const accountId = getAccountIdFromUrl(req);

  const body = await readJson(req);
  if (!isRecord(body)) return badRequest('Invalid JSON');

  const VALID_TYPES = ['CURRENT', 'SAVINGS', 'INVEST', 'CASH', 'LOAN'] as const;
  type ValidType = (typeof VALID_TYPES)[number];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const typeRaw = typeof body.type === 'string' ? body.type : '';
  const type: ValidType | null = VALID_TYPES.includes(typeRaw as ValidType)
    ? (typeRaw as ValidType)
    : null;
  const institution =
    typeof body.institution === 'string'
      ? body.institution.trim() || null
      : null;
  const iban = typeof body.iban === 'string' ? body.iban.trim() || null : null;
  const initialCentsRaw =
    typeof body.initialCents === 'number' || typeof body.initialCents === 'string'
      ? body.initialCents
      : null;

  // New fields
  const bankCode = typeof body.bankCode === 'string' ? body.bankCode.trim() || null : null;
  const productCode = typeof body.productCode === 'string' ? body.productCode.trim() || null : null;
  const interestRateBps =
    typeof body.interestRateBps === 'number' && Number.isFinite(body.interestRateBps)
      ? Math.round(body.interestRateBps)
      : null;
  const loanDurationMonths =
    typeof body.loanDurationMonths === 'number' && Number.isFinite(body.loanDurationMonths)
      ? Math.round(body.loanDurationMonths)
      : null;
  const loanStartDate =
    typeof body.loanStartDate === 'string' && body.loanStartDate
      ? new Date(body.loanStartDate)
      : null;

  if (!name) return badRequest('name required');
  if (name.length > 120) return badRequest('name too long');
  if (!type) return badRequest('type invalid');
  if (institution && institution.length > 120) return badRequest('institution too long');
  if (iban && iban.length > 34) return badRequest('iban too long');
  if (initialCentsRaw === null) return badRequest('initialCents required');

  let initialCents: bigint;
  try {
    initialCents = BigInt(
      typeof initialCentsRaw === 'number'
        ? Math.trunc(initialCentsRaw)
        : (initialCentsRaw ?? '0').toString().trim() || '0'
    );
  } catch {
    return badRequest('initialCents invalid');
  }

  let loanPrincipalCents: bigint | null = null;
  if (body.loanPrincipalCents != null) {
    try {
      loanPrincipalCents = BigInt(
        typeof body.loanPrincipalCents === 'number'
          ? Math.trunc(body.loanPrincipalCents)
          : String(body.loanPrincipalCents).trim()
      );
    } catch {
      return badRequest('loanPrincipalCents invalid');
    }
  }

  const hidden = typeof body.hidden === 'boolean' ? body.hidden : undefined;

  if (loanStartDate && isNaN(loanStartDate.getTime())) {
    return badRequest('Invalid loanStartDate');
  }

  const account = await prisma.personalAccount.findFirst({
    where: { id: accountId, userId: ctx.userId },
    select: { id: true },
  });

  if (!account) return notFound('Account not found');

  const updated = await prisma.personalAccount.update({
    where: { id: accountId },
    data: {
      name,
      type,
      institution,
      iban,
      initialCents,
      bankCode,
      productCode,
      interestRateBps,
      loanPrincipalCents,
      loanDurationMonths,
      loanStartDate,
      ...(hidden !== undefined ? { hidden } : {}),
    },
  });

  return jsonb({ account: { id: updated.id, name: updated.name } }, ctx.requestId);
});

export const DELETE = withPersonalRoute(async (ctx, req) => {
  const accountId = getAccountIdFromUrl(req);

  const account = await prisma.personalAccount.findFirst({
    where: { id: accountId, userId: ctx.userId },
    select: { id: true },
  });

  if (!account) return notFound('Account not found');

  await prisma.personalAccount.delete({ where: { id: accountId } });

  return jsonbNoContent(ctx.requestId);
});
