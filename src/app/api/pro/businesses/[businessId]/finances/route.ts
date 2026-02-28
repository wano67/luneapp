import { prisma } from '@/server/db/client';
import { FinanceType, PaymentMethod, RecurringUnit } from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, withIdNoStore } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';
import { parseCentsInput, parseEuroToCents } from '@/lib/money';
import { addMonths, enumerateMonthlyDates } from '@/server/finances/recurring';
import { parseIdOpt, parseDateOpt } from '@/server/http/parsers';

function isValidType(value: unknown): value is FinanceType {
  return value === 'INCOME' || value === 'EXPENSE';
}

function parseAmountCents(raw: unknown): bigint | null {
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

async function ensureRecurringFinanceHorizon(params: {
  businessId: bigint;
  monthsAhead?: number;
}) {
  const monthsAhead = params.monthsAhead ?? 12;
  if (monthsAhead <= 0) return;
  const rules = await prisma.financeRecurringRule.findMany({
    where: { businessId: params.businessId, isActive: true, frequency: RecurringUnit.MONTHLY },
  });
  if (!rules.length) return;

  const now = new Date();
  const baseMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
  const entries: Array<{
    businessId: bigint;
    projectId: bigint | null;
    categoryReferenceId: bigint | null;
    recurringRuleId: bigint;
    type: FinanceType;
    amountCents: bigint;
    category: string;
    vendor: string | null;
    method: PaymentMethod | null;
    isRecurring: boolean;
    recurringUnit: RecurringUnit;
    date: Date;
    note: string | null;
    isRuleOverride: boolean;
    lockedFromRule: boolean;
  }> = [];

  for (const rule of rules) {
    const dates = enumerateMonthlyDates({
      startDate: rule.startDate,
      endDate: rule.endDate ?? null,
      dayOfMonth: rule.dayOfMonth,
      from: baseMonth,
      to: endMonth,
    });
    for (const target of dates) {
      entries.push({
        businessId: rule.businessId,
        projectId: rule.projectId ?? null,
        categoryReferenceId: rule.categoryReferenceId ?? null,
        recurringRuleId: rule.id,
        type: rule.type,
        amountCents: rule.amountCents,
        category: rule.category,
        vendor: rule.vendor ?? null,
        method: rule.method ?? null,
        isRecurring: true,
        recurringUnit: rule.frequency,
        date: target,
        note: rule.note ?? null,
        isRuleOverride: false,
        lockedFromRule: false,
      });
    }
  }

  if (!entries.length) return;
  await prisma.finance.createMany({
    data: entries,
    skipDuplicates: true,
  });
}

const PAYMENT_METADATA_KEYS = [
  'clientName',
  'project',
  'invoiceId',
  'method',
  'status',
  'expectedAt',
  'receivedAt',
  'currency',
  'note',
] as const;

type PaymentMetadata = Partial<Record<(typeof PAYMENT_METADATA_KEYS)[number], string>>;

function parseMetadataFromNote(note: string | null | undefined): PaymentMetadata | null {
  if (!note) return null;
  try {
    const parsed = JSON.parse(note);
    if (!parsed || typeof parsed !== 'object') return null;
    const meta: PaymentMetadata = {};
    for (const key of PAYMENT_METADATA_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) {
        meta[key] = value.trim();
      }
    }
    return Object.keys(meta).length > 0 ? meta : null;
  } catch {
    return null;
  }
}

function sanitizeMetadata(raw: unknown): PaymentMetadata | null {
  if (!raw || typeof raw !== 'object') return null;
  const meta: PaymentMetadata = {};
  for (const key of PAYMENT_METADATA_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      meta[key] = value.trim();
    }
  }
  return Object.keys(meta).length > 0 ? meta : null;
}

function serializeFinance(finance: {
  id: bigint;
  businessId: bigint;
  projectId: bigint | null;
  inventoryMovementId?: bigint | null;
  inventoryProductId?: bigint | null;
  type: FinanceType;
  amountCents: bigint;
  category: string;
  vendor?: string | null;
  method?: PaymentMethod | null;
  isRecurring?: boolean;
  recurringUnit?: RecurringUnit | null;
  recurringRuleId?: bigint | null;
  isRuleOverride?: boolean;
  lockedFromRule?: boolean;
  date: Date;
  note: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { name: string | null } | null;
  categoryReferenceId?: bigint | null;
  categoryReference?: { id: bigint; name: string | null } | null;
  tags?: Array<{ referenceId: bigint; reference: { id: bigint; name: string } }>;
}) {
  const metadata = parseMetadataFromNote(finance.note);

  return {
    id: finance.id.toString(),
    businessId: finance.businessId.toString(),
    projectId: finance.projectId ? finance.projectId.toString() : null,
    projectName: finance.project?.name ?? null,
    inventoryMovementId: finance.inventoryMovementId ? finance.inventoryMovementId.toString() : null,
    inventoryProductId: finance.inventoryProductId ? finance.inventoryProductId.toString() : null,
    categoryReferenceId: finance.categoryReferenceId ? finance.categoryReferenceId.toString() : null,
    categoryReferenceName: finance.categoryReference?.name ?? null,
    tagReferences: finance.tags
      ? finance.tags.map((tag) => ({
          id: tag.reference.id.toString(),
          name: tag.reference.name,
        }))
      : [],
    type: finance.type,
    amountCents: finance.amountCents.toString(),
    amount: Number(finance.amountCents) / 100,
    category: finance.category,
    vendor: finance.vendor ?? null,
    method: finance.method ?? null,
    isRecurring: Boolean(finance.isRecurring),
    recurringUnit: finance.recurringUnit ?? null,
    recurringRuleId: finance.recurringRuleId ? finance.recurringRuleId.toString() : null,
    isRuleOverride: Boolean(finance.isRuleOverride),
    lockedFromRule: Boolean(finance.lockedFromRule),
    date: finance.date.toISOString(),
    note: finance.note,
    deletedAt: finance.deletedAt ? finance.deletedAt.toISOString() : null,
    createdAt: finance.createdAt.toISOString(),
    updatedAt: finance.updatedAt.toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}

// GET /api/pro/businesses/{businessId}/finances
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const delegateError = ensureDelegate('finance', requestId);
  if (delegateError) return delegateError;

  await ensureRecurringFinanceHorizon({ businessId: businessIdBigInt });

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');
  const typeFilter = isValidType(typeParam) ? typeParam : null;
  const projectParam = searchParams.get('projectId');
  const projectIdFilter = projectParam ? parseIdOpt(projectParam) : null;
  if (projectParam && !projectIdFilter) {
    return withIdNoStore(badRequest('projectId invalide.'), requestId);
  }
  const startParam = searchParams.get('periodStart') ?? searchParams.get('from');
  const endParam = searchParams.get('periodEnd') ?? searchParams.get('to');
  const fromDate = startParam ? parseDateOpt(startParam) : null;
  const toDate = endParam ? parseDateOpt(endParam) : null;
  if (startParam && !fromDate) {
    return withIdNoStore(badRequest('periodStart invalide.'), requestId);
  }
  if (endParam && !toDate) {
    return withIdNoStore(badRequest('periodEnd invalide.'), requestId);
  }
  const aggregate = searchParams.get('aggregate') === '1';
  const categoryParam = searchParams.get('category')?.trim();
  const categoryReferenceIdParam = searchParams.get('categoryReferenceId');
  const categoryReferenceId = categoryReferenceIdParam ? parseIdOpt(categoryReferenceIdParam) : null;
  if (categoryReferenceIdParam && !categoryReferenceId) {
    return withIdNoStore(badRequest('categoryReferenceId invalide.'), requestId);
  }
  const tagReferenceIdParam = searchParams.get('tagReferenceId');
  const tagReferenceId = tagReferenceIdParam ? parseIdOpt(tagReferenceIdParam) : null;
  if (tagReferenceIdParam && !tagReferenceId) {
    return withIdNoStore(badRequest('tagReferenceId invalide.'), requestId);
  }

  const where = {
    businessId: businessIdBigInt,
    deletedAt: null,
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(projectIdFilter ? { projectId: projectIdFilter } : {}),
    ...(categoryParam ? { category: categoryParam } : {}),
    ...(categoryReferenceId ? { categoryReferenceId } : {}),
    ...(tagReferenceId ? { tags: { some: { referenceId: tagReferenceId } } } : {}),
    ...(fromDate || toDate
      ? {
          date: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  } as const;

  if (aggregate) {
    const sums = await prisma.finance.groupBy({
      by: ['type'],
      _sum: { amountCents: true },
      where,
    });
    const income = sums.find((s) => s.type === FinanceType.INCOME)?._sum.amountCents ?? BigInt(0);
    const expense = sums.find((s) => s.type === FinanceType.EXPENSE)?._sum.amountCents ?? BigInt(0);

    return jsonb({ incomeCents: income.toString(), expenseCents: expense.toString(), netCents: (income - expense).toString() }, requestId);
  }

  const finances = await prisma.finance.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      project: { select: { name: true } },
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  return jsonb({ items: finances.map(serializeFinance) }, requestId);
});

// POST /api/pro/businesses/{businessId}/finances
export const POST = withBusinessRoute(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:finances:create:${ctx.businessId}:${ctx.userId}`,
      limit: 200,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const delegateError = ensureDelegate('finance', requestId);
  if (delegateError) return delegateError;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const typeRaw = (body as { type?: unknown }).type;
  if (!isValidType(typeRaw)) {
    return withIdNoStore(badRequest('type invalide.'), requestId);
  }

  const amountCents =
    (body as { amountCents?: unknown }).amountCents !== undefined
      ? parseAmountCentsDirect((body as { amountCents?: unknown }).amountCents)
      : parseAmountCents((body as { amount?: unknown }).amount);
  if (amountCents === null) {
    return withIdNoStore(badRequest('amount invalide.'), requestId);
  }

  const categoryRaw = (body as { category?: unknown }).category;
  if (typeof categoryRaw !== 'string' || !categoryRaw.trim()) {
    return withIdNoStore(badRequest('category requise.'), requestId);
  }
  const category = categoryRaw.trim();

  const dateParsed = parseDateOpt((body as { date?: unknown }).date);
  if (!dateParsed) {
    return withIdNoStore(badRequest('date invalide.'), requestId);
  }

  let projectId: bigint | undefined;
  const projectRaw = (body as { projectId?: unknown }).projectId;
  if (projectRaw) {
    if (typeof projectRaw !== 'string' || !/^\d+$/.test(projectRaw)) {
      return withIdNoStore(badRequest('projectId invalide.'), requestId);
    }
    projectId = BigInt(projectRaw);
    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: businessIdBigInt },
      select: { id: true },
    });
    if (!project) {
      return withIdNoStore(badRequest('projectId doit appartenir au business.'), requestId);
    }
  }

  const note =
    'note' in body && typeof (body as { note?: unknown }).note === 'string'
      ? (body as { note?: string }).note!.trim() || null
      : null;

  const vendor =
    'vendor' in body && typeof (body as { vendor?: unknown }).vendor === 'string'
      ? (body as { vendor?: string }).vendor!.trim() || null
      : null;

  const methodRaw = (body as { method?: unknown }).method;
  const method =
    typeof methodRaw === 'string' && (Object.values(PaymentMethod) as string[]).includes(methodRaw.toUpperCase())
      ? (methodRaw.toUpperCase() as PaymentMethod)
      : null;

  const isRecurring = (body as { isRecurring?: unknown }).isRecurring === true;
  const recurringUnitRaw = (body as { recurringUnit?: unknown }).recurringUnit;
  const recurringUnit =
    isRecurring &&
    typeof recurringUnitRaw === 'string' &&
    (Object.values(RecurringUnit) as string[]).includes(recurringUnitRaw.toUpperCase())
      ? (recurringUnitRaw.toUpperCase() as RecurringUnit)
      : null;
  const recurringMonthsRaw = (body as { recurringMonths?: unknown }).recurringMonths;
  const recurringMonths =
    isRecurring && recurringUnit === RecurringUnit.MONTHLY && typeof recurringMonthsRaw === 'number' && Number.isFinite(recurringMonthsRaw)
      ? Math.min(36, Math.max(1, Math.trunc(recurringMonthsRaw)))
      : isRecurring && recurringUnit === RecurringUnit.MONTHLY
        ? 12
        : 0;
  const recurringStartDateRaw = (body as { recurringStartDate?: unknown }).recurringStartDate;
  const recurringStartDate = parseDateOpt(recurringStartDateRaw) ?? dateParsed;
  const recurringEndDateRaw = (body as { recurringEndDate?: unknown }).recurringEndDate;
  const recurringEndDate = parseDateOpt(recurringEndDateRaw);
  const recurringDayRaw = (body as { recurringDayOfMonth?: unknown }).recurringDayOfMonth;
  const recurringDayOfMonth =
    typeof recurringDayRaw === 'number' && Number.isFinite(recurringDayRaw)
      ? Math.min(31, Math.max(1, Math.trunc(recurringDayRaw)))
      : typeof recurringDayRaw === 'string' && /^\d+$/.test(recurringDayRaw)
        ? Math.min(31, Math.max(1, Math.trunc(Number(recurringDayRaw))))
        : recurringStartDate.getDate();
  const recurringRetroactive =
    isRecurring && recurringUnit === RecurringUnit.MONTHLY
      ? (body as { recurringRetroactive?: unknown }).recurringRetroactive !== false
      : false;

  const metadata = sanitizeMetadata((body as { metadata?: unknown }).metadata);
  const noteToStore = metadata ? JSON.stringify(metadata) : note;

  const categoryProvided = Object.prototype.hasOwnProperty.call(body, 'categoryReferenceId');
  const categoryReferenceId =
    categoryProvided && typeof (body as { categoryReferenceId?: unknown }).categoryReferenceId === 'string'
      ? (() => {
          const raw = (body as { categoryReferenceId: string }).categoryReferenceId;
          return /^\d+$/.test(raw) ? BigInt(raw) : null;
        })()
      : categoryProvided
        ? null
        : undefined;

  const tagProvided = Object.prototype.hasOwnProperty.call(body, 'tagReferenceIds');
  const tagReferenceIds: bigint[] | undefined = tagProvided
    ? Array.from(
        new Set(
          ((Array.isArray((body as { tagReferenceIds?: unknown }).tagReferenceIds)
            ? (body as { tagReferenceIds: unknown[] }).tagReferenceIds
            : []) as unknown[])
            .filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id))
            .map((id) => BigInt(id))
        )
      )
    : undefined;

  const validated = await validateCategoryAndTags(businessIdBigInt, categoryReferenceId ?? null, tagReferenceIds);
  if ('error' in validated) {
    return withIdNoStore(badRequest(validated.error), requestId);
  }

  let recurringRuleId: bigint | null = null;
  const entryDate =
    isRecurring && recurringUnit === RecurringUnit.MONTHLY ? recurringStartDate : dateParsed;
  if (isRecurring && recurringUnit === RecurringUnit.MONTHLY) {
    const rule = await prisma.financeRecurringRule.create({
      data: {
        businessId: businessIdBigInt,
        projectId: projectId ?? null,
        categoryReferenceId: validated.categoryId ?? null,
        type: typeRaw,
        amountCents,
        category,
        vendor,
        method,
        note: noteToStore,
        startDate: recurringStartDate,
        endDate: recurringEndDate,
        dayOfMonth: recurringDayOfMonth,
        frequency: RecurringUnit.MONTHLY,
        nextRunAt: addMonths(recurringStartDate, 1, recurringDayOfMonth),
        isActive: true,
      },
      select: { id: true },
    });
    recurringRuleId = rule.id;
  }

  const finance = await prisma.finance.create({
    data: {
      businessId: businessIdBigInt,
      projectId,
      type: typeRaw,
      amountCents,
      category,
      vendor,
      method,
      isRecurring,
      recurringUnit,
      recurringRuleId: recurringRuleId ?? undefined,
      date: entryDate,
      isRuleOverride: false,
      lockedFromRule: false,
      note: noteToStore,
      categoryReferenceId: validated.categoryId ?? undefined,
      tags:
        validated.tagIds.length > 0
          ? {
              create: validated.tagIds.map((id) => ({ referenceId: id })),
            }
          : undefined,
    },
    include: {
      project: { select: { name: true } },
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });

  if (recurringRuleId && recurringMonths > 0) {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startMonth = new Date(recurringStartDate.getFullYear(), recurringStartDate.getMonth(), 1);
    const pastDates =
      recurringRetroactive && startMonth < currentMonth
        ? enumerateMonthlyDates({
            startDate: recurringStartDate,
            endDate: recurringEndDate,
            dayOfMonth: recurringDayOfMonth,
            from: startMonth,
            to: currentMonth,
          })
        : [];
    const futureStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const futureEnd = new Date(now.getFullYear(), now.getMonth() + recurringMonths, 1);
    const futureDates = enumerateMonthlyDates({
      startDate: recurringStartDate,
      endDate: recurringEndDate,
      dayOfMonth: recurringDayOfMonth,
      from: futureStart,
      to: futureEnd,
    });
    const entries = [...pastDates, ...futureDates].map((occurrenceDate) => ({
      businessId: businessIdBigInt,
      projectId: projectId ?? null,
      categoryReferenceId: validated.categoryId ?? null,
      recurringRuleId,
      type: typeRaw,
      amountCents,
      category,
      vendor,
      method,
      isRecurring: true,
      recurringUnit: RecurringUnit.MONTHLY,
      date: occurrenceDate,
      note: noteToStore,
      isRuleOverride: false,
      lockedFromRule: false,
    }));
    if (entries.length) {
      await prisma.finance.createMany({ data: entries, skipDuplicates: true });
    }
  }

  return jsonb({ item: serializeFinance(finance) }, requestId, { status: 201 });
  });

