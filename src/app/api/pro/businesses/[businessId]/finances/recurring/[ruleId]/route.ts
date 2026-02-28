import { prisma } from '@/server/db/client';
import { FinanceType, PaymentMethod, RecurringUnit } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { parseCentsInput, parseEuroToCents } from '@/lib/money';
import { addMonths, enumerateMonthlyDates } from '@/server/finances/recurring';
import { parseIdOpt, parseDateOpt } from '@/server/http/parsers';

function parseAmountCents(raw: unknown): bigint | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const num = parseEuroToCents(raw);
  if (!Number.isFinite(num)) return null;
  return BigInt(num);
}

function parseAmountCentsDirect(raw: unknown): bigint | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = parseCentsInput(raw);
  if (parsed == null) return null;
  return BigInt(parsed);
}

async function generateOccurrences(params: {
  rule: {
    id: bigint;
    businessId: bigint;
    projectId: bigint | null;
    categoryReferenceId: bigint | null;
    type: FinanceType;
    amountCents: bigint;
    category: string;
    vendor: string | null;
    method: PaymentMethod | null;
    note: string | null;
    startDate: Date;
    endDate: Date | null;
    dayOfMonth: number;
    frequency: RecurringUnit;
  };
  from: Date;
  to: Date;
}) {
  const dates = enumerateMonthlyDates({
    startDate: params.rule.startDate,
    endDate: params.rule.endDate,
    dayOfMonth: params.rule.dayOfMonth,
    from: params.from,
    to: params.to,
  });
  if (!dates.length) return;

  await prisma.finance.createMany({
    data: dates.map((date) => ({
      businessId: params.rule.businessId,
      projectId: params.rule.projectId ?? null,
      categoryReferenceId: params.rule.categoryReferenceId ?? null,
      recurringRuleId: params.rule.id,
      type: params.rule.type,
      amountCents: params.rule.amountCents,
      category: params.rule.category,
      vendor: params.rule.vendor ?? null,
      method: params.rule.method ?? null,
      isRecurring: true,
      recurringUnit: RecurringUnit.MONTHLY,
      date,
      note: params.rule.note ?? null,
      isRuleOverride: false,
      lockedFromRule: false,
    })),
    skipDuplicates: true,
  });
}

// GET /api/pro/businesses/{businessId}/finances/recurring/{ruleId}
export const GET = withBusinessRoute<{ businessId: string; ruleId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { ruleId } = await params;
    const ruleIdBigInt = parseIdOpt(ruleId);
    if (!ruleIdBigInt) {
      return withIdNoStore(badRequest('ruleId invalide.'), requestId);
    }

    const rule = await prisma.financeRecurringRule.findFirst({
      where: { id: ruleIdBigInt, businessId: businessIdBigInt },
    });
    if (!rule) return withIdNoStore(notFound('Règle introuvable.'), requestId);

    const { searchParams } = new URL(request.url);
    const from = parseDateOpt(searchParams.get('from'));
    const to = parseDateOpt(searchParams.get('to'));
    const limitRaw = searchParams.get('limit');
    const limit = limitRaw && /^\d+$/.test(limitRaw) ? Math.min(240, Math.max(1, Number(limitRaw))) : 120;

    const now = new Date();
    const defaultFrom = rule.startDate;
    const defaultTo = addMonths(now, 12, rule.dayOfMonth);

    const occurrences = await prisma.finance.findMany({
      where: {
        businessId: businessIdBigInt,
        recurringRuleId: rule.id,
        deletedAt: null,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {
              date: {
                gte: defaultFrom,
                lte: defaultTo,
              },
            }),
      },
      orderBy: { date: 'asc' },
      take: limit,
    });

    return jsonb(
      {
        item: rule,
        occurrences,
      },
      requestId
    );
  }
);

// PATCH /api/pro/businesses/{businessId}/finances/recurring/{ruleId}
export const PATCH = withBusinessRoute<{ businessId: string; ruleId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:finances:recurring:update:${ctx.businessId}:${ctx.userId}`,
      limit: 80,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { ruleId } = await params;
    const ruleIdBigInt = parseIdOpt(ruleId);
    if (!ruleIdBigInt) {
      return withIdNoStore(badRequest('ruleId invalide.'), requestId);
    }

    const existing = await prisma.financeRecurringRule.findFirst({
      where: { id: ruleIdBigInt, businessId: businessIdBigInt },
    });
    if (!existing) return withIdNoStore(notFound('Règle introuvable.'), requestId);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const data: Record<string, unknown> = {};

    if ('amount' in body || 'amountCents' in body) {
      const amountCents =
        'amountCents' in body
          ? parseAmountCentsDirect((body as { amountCents?: unknown }).amountCents)
          : parseAmountCents((body as { amount?: unknown }).amount);
      if (amountCents === null) return withIdNoStore(badRequest('amount invalide.'), requestId);
      data.amountCents = amountCents;
    }

    if ('category' in body) {
      const categoryRaw = (body as { category?: unknown }).category;
      if (typeof categoryRaw !== 'string' || !categoryRaw.trim()) {
        return withIdNoStore(badRequest('category invalide.'), requestId);
      }
      data.category = categoryRaw.trim();
    }

    if ('vendor' in body) {
      const vendorRaw = (body as { vendor?: unknown }).vendor;
      if (vendorRaw === null || vendorRaw === undefined || vendorRaw === '') data.vendor = null;
      else if (typeof vendorRaw === 'string') data.vendor = vendorRaw.trim();
      else return withIdNoStore(badRequest('vendor invalide.'), requestId);
    }

    if ('method' in body) {
      const methodRaw = (body as { method?: unknown }).method;
      if (methodRaw === null || methodRaw === undefined || methodRaw === '') {
        data.method = null;
      } else if (
        typeof methodRaw === 'string' &&
        (Object.values(PaymentMethod) as string[]).includes(methodRaw.toUpperCase())
      ) {
        data.method = methodRaw.toUpperCase() as PaymentMethod;
      } else {
        return withIdNoStore(badRequest('method invalide.'), requestId);
      }
    }

    if ('note' in body) {
      const noteRaw = (body as { note?: unknown }).note;
      if (noteRaw === null || noteRaw === undefined || noteRaw === '') data.note = null;
      else if (typeof noteRaw === 'string') data.note = noteRaw.trim();
      else return withIdNoStore(badRequest('note invalide.'), requestId);
    }

    if ('startDate' in body) {
      const parsed = parseDateOpt((body as { startDate?: unknown }).startDate);
      if (!parsed) return withIdNoStore(badRequest('startDate invalide.'), requestId);
      data.startDate = parsed;
    }

    if ('endDate' in body) {
      const parsed = parseDateOpt((body as { endDate?: unknown }).endDate);
      data.endDate = parsed;
    }

    if ('dayOfMonth' in body) {
      const raw = (body as { dayOfMonth?: unknown }).dayOfMonth;
      const day =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.min(31, Math.max(1, Math.trunc(raw)))
          : typeof raw === 'string' && /^\d+$/.test(raw)
            ? Math.min(31, Math.max(1, Math.trunc(Number(raw))))
            : null;
      if (!day) return withIdNoStore(badRequest('dayOfMonth invalide.'), requestId);
      data.dayOfMonth = day;
    }

    if ('isActive' in body) {
      const activeRaw = (body as { isActive?: unknown }).isActive;
      if (activeRaw === true || activeRaw === false) data.isActive = activeRaw;
      else return withIdNoStore(badRequest('isActive invalide.'), requestId);
    }

    const applyToFuture =
      (body as { applyToFuture?: unknown }).applyToFuture === undefined
        ? true
        : (body as { applyToFuture?: unknown }).applyToFuture === true;
    const recalcFuture = (body as { recalculateFuture?: unknown }).recalculateFuture === true;
    const horizonRaw = (body as { horizonMonths?: unknown }).horizonMonths;
    const horizonMonths =
      typeof horizonRaw === 'number' && Number.isFinite(horizonRaw)
        ? Math.min(36, Math.max(1, Math.trunc(horizonRaw)))
        : 12;

    if (Object.keys(data).length === 0 && !applyToFuture && !recalcFuture) {
      return withIdNoStore(badRequest('Aucune modification.'), requestId);
    }

    const updated = await prisma.financeRecurringRule.update({
      where: { id: ruleIdBigInt },
      data,
    });

    if (applyToFuture || recalcFuture) {
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const futureLimit = new Date(now.getFullYear(), now.getMonth() + horizonMonths, 1);

      if (recalcFuture) {
        await prisma.finance.updateMany({
          where: {
            recurringRuleId: updated.id,
            deletedAt: null,
            date: { gte: currentMonth },
            lockedFromRule: false,
          },
          data: { deletedAt: now },
        });
        await generateOccurrences({
          rule: updated,
          from: currentMonth,
          to: futureLimit,
        });
      } else {
        const futureEntries = await prisma.finance.findMany({
          where: {
            recurringRuleId: updated.id,
            deletedAt: null,
            date: { gte: currentMonth },
            lockedFromRule: false,
          },
        });

        for (const entry of futureEntries) {
          const diffMonths =
            (entry.date.getFullYear() - updated.startDate.getFullYear()) * 12 +
            (entry.date.getMonth() - updated.startDate.getMonth());
          const nextDate = addMonths(updated.startDate, diffMonths, updated.dayOfMonth);

          if (entry.date < updated.startDate || (updated.endDate && entry.date > updated.endDate)) {
            await prisma.finance.update({
              where: { id: entry.id },
              data: { deletedAt: now },
            });
            continue;
          }

          await prisma.finance.update({
            where: { id: entry.id },
            data: {
              amountCents: updated.amountCents,
              category: updated.category,
              vendor: updated.vendor ?? null,
              method: updated.method ?? null,
              note: updated.note ?? null,
              date: nextDate,
            },
          });
        }

        await generateOccurrences({
          rule: updated,
          from: currentMonth,
          to: futureLimit,
        });
      }
    }

    return jsonb({ item: updated }, requestId);
  }
);
