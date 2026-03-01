import { prisma } from '@/server/db/client';
import { FinanceType, PaymentMethod, RecurringUnit } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { parseCentsInput } from '@/lib/money';
import { parseDateOpt } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/finances/recurring
export const GET = withBusinessRoute<{ businessId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type');
    const activeParam = searchParams.get('active');

    const where: Record<string, unknown> = { businessId: businessIdBigInt };
    if (typeParam && (Object.values(FinanceType) as string[]).includes(typeParam)) {
      where.type = typeParam as FinanceType;
    }
    if (activeParam === 'true') where.isActive = true;
    else if (activeParam === 'false') where.isActive = false;

    const rules = await prisma.financeRecurringRule.findMany({
      where,
      orderBy: { startDate: 'desc' },
      take: 100,
    });

    return jsonb({ items: rules }, requestId);
  }
);

// POST /api/pro/businesses/{businessId}/finances/recurring
export const POST = withBusinessRoute<{ businessId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:finances:recurring:create:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const b = body as Record<string, unknown>;

    // type (required)
    const typeRaw = b.type;
    if (typeof typeRaw !== 'string' || !(Object.values(FinanceType) as string[]).includes(typeRaw)) {
      return withIdNoStore(badRequest('type requis (INCOME ou EXPENSE).'), requestId);
    }

    // amountCents (required)
    const amountCents = parseCentsInput(b.amountCents);
    if (amountCents == null || amountCents <= 0) {
      return withIdNoStore(badRequest('amountCents requis et > 0.'), requestId);
    }

    // category (required)
    const category = typeof b.category === 'string' ? b.category.trim() : '';
    if (!category) {
      return withIdNoStore(badRequest('category requis.'), requestId);
    }

    // vendor (optional)
    const vendor = typeof b.vendor === 'string' && b.vendor.trim() ? b.vendor.trim() : null;

    // method (optional)
    let method: PaymentMethod | null = null;
    if (typeof b.method === 'string' && (Object.values(PaymentMethod) as string[]).includes(b.method.toUpperCase())) {
      method = b.method.toUpperCase() as PaymentMethod;
    }

    // note (optional)
    const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null;

    // startDate (required)
    const startDate = parseDateOpt(b.startDate);
    if (!startDate) {
      return withIdNoStore(badRequest('startDate requis.'), requestId);
    }

    // endDate (optional)
    const endDate = parseDateOpt(b.endDate) ?? null;

    // dayOfMonth (required)
    const dayRaw = b.dayOfMonth;
    const dayOfMonth =
      typeof dayRaw === 'number' && Number.isFinite(dayRaw)
        ? Math.min(31, Math.max(1, Math.trunc(dayRaw)))
        : typeof dayRaw === 'string' && /^\d+$/.test(dayRaw)
          ? Math.min(31, Math.max(1, Math.trunc(Number(dayRaw))))
          : null;
    if (!dayOfMonth) {
      return withIdNoStore(badRequest('dayOfMonth requis (1-31).'), requestId);
    }

    // frequency (optional, default MONTHLY)
    let frequency: RecurringUnit = RecurringUnit.MONTHLY;
    if (typeof b.frequency === 'string' && (Object.values(RecurringUnit) as string[]).includes(b.frequency)) {
      frequency = b.frequency as RecurringUnit;
    }

    const rule = await prisma.financeRecurringRule.create({
      data: {
        businessId: businessIdBigInt,
        type: typeRaw as FinanceType,
        amountCents: BigInt(amountCents),
        category,
        vendor,
        method,
        note,
        startDate,
        endDate,
        dayOfMonth,
        frequency,
        isActive: true,
      },
    });

    return jsonbCreated({ item: rule }, requestId);
  }
);
