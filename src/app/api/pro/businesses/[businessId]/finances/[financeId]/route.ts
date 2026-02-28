import { prisma } from '@/server/db/client';
import { FinanceType, PaymentMethod, RecurringUnit } from '@/generated/prisma';
import { validateCategoryAndTags } from '@/server/http/validators';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { ensureDelegate } from '@/server/http/delegates';
import { parseCentsInput, parseEuroToCents } from '@/lib/money';
import { parseIdOpt, parseDateOpt } from '@/server/http/parsers';

function isValidType(value: unknown): value is FinanceType {
  return value === 'INCOME' || value === 'EXPENSE';
}

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

function enrichFinance(finance: {
  amountCents: bigint;
  note: string | null;
  project?: { name: string | null } | null;
  categoryReference?: { id: bigint; name: string | null } | null;
  tags?: Array<{ referenceId: bigint; reference: { id: bigint; name: string } }>;
}) {
  const metadata = parseMetadataFromNote(finance.note);
  return {
    ...finance,
    amount: Number(finance.amountCents) / 100,
    projectName: finance.project?.name ?? null,
    categoryReferenceName: finance.categoryReference?.name ?? null,
    tagReferences: finance.tags
      ? finance.tags.map((tag) => tag.reference)
      : [],
    ...(metadata ? { metadata } : {}),
  };
}

// GET /api/pro/businesses/{businessId}/finances/{financeId}
export const GET = withBusinessRoute<{ businessId: string; financeId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const delegateError = ensureDelegate('finance', requestId);
    if (delegateError) return delegateError;

    const financeIdBigInt = parseIdOpt(params.financeId);
    if (!financeIdBigInt) return withIdNoStore(badRequest('financeId invalide.'), requestId);

    const finance = await prisma.finance.findFirst({
      where: { id: financeIdBigInt, businessId: businessIdBigInt, deletedAt: null },
      include: {
        project: { select: { name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
    });
    if (!finance) return withIdNoStore(notFound('Opération introuvable.'), requestId);

    return jsonb({ item: enrichFinance(finance) }, requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/finances/{financeId}
export const PATCH = withBusinessRoute<{ businessId: string; financeId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:finances:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const delegateError = ensureDelegate('finance', requestId);
    if (delegateError) return delegateError;

    const financeIdBigInt = parseIdOpt(params.financeId);
    if (!financeIdBigInt) return withIdNoStore(badRequest('financeId invalide.'), requestId);

    const existing = await prisma.finance.findFirst({
      where: { id: financeIdBigInt, businessId: businessIdBigInt, deletedAt: null },
      include: {
        project: { select: { name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
    });
    if (!existing) return withIdNoStore(notFound('Opération introuvable.'), requestId);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const data: Record<string, unknown> = {};

    if ('type' in body) {
      if (!isValidType((body as { type?: unknown }).type)) {
        return withIdNoStore(badRequest('type invalide.'), requestId);
      }
      data.type = (body as { type: FinanceType }).type;
    }

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

    if ('date' in body) {
      const parsed = parseDateOpt((body as { date?: unknown }).date);
      if (!parsed) return withIdNoStore(badRequest('date invalide.'), requestId);
      data.date = parsed;
    }

    if ('note' in body) {
      const noteRaw = (body as { note?: unknown }).note;
      if (noteRaw === null || noteRaw === undefined || noteRaw === '') data.note = null;
      else if (typeof noteRaw === 'string') data.note = noteRaw.trim();
      else return withIdNoStore(badRequest('note invalide.'), requestId);
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

    if ('isRecurring' in body) {
      const recurringRaw = (body as { isRecurring?: unknown }).isRecurring;
      if (recurringRaw === null || recurringRaw === undefined || recurringRaw === '') {
        data.isRecurring = false;
      } else if (recurringRaw === true || recurringRaw === false) {
        data.isRecurring = recurringRaw;
      } else {
        return withIdNoStore(badRequest('isRecurring invalide.'), requestId);
      }
    }

    if ('recurringUnit' in body) {
      const recurringUnitRaw = (body as { recurringUnit?: unknown }).recurringUnit;
      if (recurringUnitRaw === null || recurringUnitRaw === undefined || recurringUnitRaw === '') {
        data.recurringUnit = null;
      } else if (
        typeof recurringUnitRaw === 'string' &&
        (Object.values(RecurringUnit) as string[]).includes(recurringUnitRaw.toUpperCase())
      ) {
        data.recurringUnit = recurringUnitRaw.toUpperCase() as RecurringUnit;
      } else {
        return withIdNoStore(badRequest('recurringUnit invalide.'), requestId);
      }
    }

    const metadata = sanitizeMetadata((body as { metadata?: unknown }).metadata);
    if (metadata) {
      data.note = JSON.stringify(metadata);
    }

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

    let tagsInstruction:
      | {
          deleteMany: { financeId: bigint };
          create: Array<{ referenceId: bigint }>;
        }
      | undefined;

    if (categoryProvided || tagProvided) {
      const validated = await validateCategoryAndTags(
        businessIdBigInt,
        categoryProvided ? categoryReferenceId ?? null : existing.categoryReferenceId ?? null,
        tagProvided ? tagReferenceIds : existing.tags?.map((t) => t.referenceId)
      );
      if ('error' in validated) {
        return withIdNoStore(badRequest(validated.error), requestId);
      }
      if (categoryProvided) {
        data.categoryReferenceId = validated.categoryId;
      }
      if (tagProvided) {
        tagsInstruction = {
          deleteMany: { financeId: financeIdBigInt },
          create: validated.tagIds.map((id) => ({ referenceId: id })),
        };
      }
    }

    if ('projectId' in body) {
      const raw = (body as { projectId?: unknown }).projectId;
      if (raw === null || raw === undefined || raw === '') {
        data.projectId = null;
      } else if (typeof raw === 'string' && /^\d+$/.test(raw)) {
        const projectId = BigInt(raw);
        const project = await prisma.project.findFirst({
          where: { id: projectId, businessId: businessIdBigInt },
          select: { id: true },
        });
        if (!project) {
          return withIdNoStore(badRequest('projectId doit appartenir au business.'), requestId);
        }
        data.projectId = projectId;
      } else {
        return withIdNoStore(badRequest('projectId invalide.'), requestId);
      }
    }

    if (!tagsInstruction && Object.keys(data).length === 0) {
      return withIdNoStore(badRequest('Aucune modification.'), requestId);
    }

    const overridesRule =
      existing.recurringRuleId &&
      (Object.prototype.hasOwnProperty.call(data, 'amountCents') ||
        Object.prototype.hasOwnProperty.call(data, 'category') ||
        Object.prototype.hasOwnProperty.call(data, 'date') ||
        Object.prototype.hasOwnProperty.call(data, 'vendor') ||
        Object.prototype.hasOwnProperty.call(data, 'method') ||
        Object.prototype.hasOwnProperty.call(data, 'note') ||
        categoryProvided ||
        tagProvided);
    if (overridesRule) {
      data.isRuleOverride = true;
      data.lockedFromRule = true;
    }

    const updated = await prisma.finance.update({
      where: { id: financeIdBigInt },
      data: {
        ...data,
        ...(tagsInstruction ? { tags: tagsInstruction } : {}),
      },
      include: {
        project: { select: { name: true } },
        categoryReference: { select: { id: true, name: true } },
        tags: { include: { reference: { select: { id: true, name: true } } } },
      },
    });

    return jsonb({ item: enrichFinance(updated) }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/finances/{financeId}
export const DELETE = withBusinessRoute<{ businessId: string; financeId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:finances:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const financeIdBigInt = parseIdOpt(params.financeId);
    if (!financeIdBigInt) return withIdNoStore(badRequest('financeId invalide.'), requestId);

    const finance = await prisma.finance.findFirst({
      where: { id: financeIdBigInt, businessId: businessIdBigInt },
      select: { id: true, deletedAt: true },
    });
    if (!finance) return withIdNoStore(notFound('Opération introuvable.'), requestId);
    if (!finance.deletedAt) {
      await prisma.finance.update({
        where: { id: financeIdBigInt },
        data: { deletedAt: new Date() },
      });
    }

    return jsonbNoContent(requestId);
  }
);
