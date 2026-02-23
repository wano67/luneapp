import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessReferenceType, FinanceType, PaymentMethod, RecurringUnit } from '@/generated/prisma';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

function ensureFinanceDelegate(requestId: string) {
  if (!(prisma as { finance?: unknown }).finance) {
    return withIdNoStore(
      NextResponse.json(
        { error: 'Prisma client not generated / wrong import (finance delegate absent).' },
        { status: 500 }
      ),
      requestId
    );
  }
  return null;
}

function isValidType(value: unknown): value is FinanceType {
  return value === 'INCOME' || value === 'EXPENSE';
}

function parseAmountCents(raw: unknown): bigint | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const num = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(num)) return null;
  return BigInt(Math.round(num * 100));
}

function parseAmountCentsDirect(raw: unknown): bigint | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const num = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(num)) return null;
  return BigInt(Math.trunc(num));
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

async function validateCategoryAndTags(
  businessId: bigint,
  categoryReferenceId: bigint | null,
  tagReferenceIds?: bigint[]
): Promise<{ categoryId: bigint | null; tagIds: bigint[] } | { error: string }> {
  if (categoryReferenceId) {
    const category = await prisma.businessReference.findFirst({
      where: {
        id: categoryReferenceId,
        businessId,
        type: BusinessReferenceType.CATEGORY,
        isArchived: false,
      },
      select: { id: true },
    });
    if (!category) return { error: 'categoryReferenceId invalide pour ce business.' };
  }

  let tagIds: bigint[] = [];
  if (tagReferenceIds && tagReferenceIds.length) {
    const tags = await prisma.businessReference.findMany({
      where: {
        id: { in: tagReferenceIds },
        businessId,
        type: BusinessReferenceType.TAG,
        isArchived: false,
      },
      select: { id: true },
    });
    if (tags.length !== tagReferenceIds.length) {
      return { error: 'tagReferenceIds invalides pour ce business.' };
    }
    tagIds = tags.map((t) => t.id);
  }

  return { categoryId: categoryReferenceId, tagIds };
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
    date: finance.date.toISOString(),
    note: finance.note,
    deletedAt: finance.deletedAt ? finance.deletedAt.toISOString() : null,
    createdAt: finance.createdAt.toISOString(),
    updatedAt: finance.updatedAt.toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}

// GET /api/pro/businesses/{businessId}/finances/{financeId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; financeId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, financeId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureFinanceDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  const financeIdBigInt = parseId(financeId);
  if (!businessIdBigInt || !financeIdBigInt) {
    return withIdNoStore(badRequest('businessId ou financeId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const finance = await prisma.finance.findFirst({
    where: { id: financeIdBigInt, businessId: businessIdBigInt, deletedAt: null },
    include: {
      project: { select: { name: true } },
      categoryReference: { select: { id: true, name: true } },
      tags: { include: { reference: { select: { id: true, name: true } } } },
    },
  });
  if (!finance) return withIdNoStore(notFound('Opération introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ item: serializeFinance(finance) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/finances/{financeId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; financeId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, financeId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const financeIdBigInt = parseId(financeId);
  if (!businessIdBigInt || !financeIdBigInt) {
    return withIdNoStore(badRequest('businessId ou financeId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureFinanceDelegate(requestId);
  if (delegateError) return delegateError;

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:finances:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

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
    const parsed = parseDate((body as { date?: unknown }).date);
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

  return withIdNoStore(jsonNoStore({ item: serializeFinance(updated) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/finances/{financeId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; financeId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, financeId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const financeIdBigInt = parseId(financeId);
  if (!businessIdBigInt || !financeIdBigInt) {
    return withIdNoStore(badRequest('businessId ou financeId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:finances:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

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

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
