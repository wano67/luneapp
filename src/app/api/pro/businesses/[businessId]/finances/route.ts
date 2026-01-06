import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BusinessReferenceType, FinanceType } from '@/generated/prisma';
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
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  const num = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isFinite(num)) return null;
  return BigInt(Math.round(num * 100));
}

function parseDate(value: unknown): Date | null {
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
  date: Date;
  note: string | null;
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
    date: finance.date.toISOString(),
    note: finance.note,
    createdAt: finance.createdAt.toISOString(),
    updatedAt: finance.updatedAt.toISOString(),
    ...(metadata ? { metadata } : {}),
  };
}

// GET /api/pro/businesses/{businessId}/finances
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureFinanceDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');
  const typeFilter = isValidType(typeParam) ? typeParam : null;
  const projectParam = searchParams.get('projectId');
  const projectIdFilter = projectParam ? parseId(projectParam) : null;
  if (projectParam && !projectIdFilter) {
    return withIdNoStore(badRequest('projectId invalide.'), requestId);
  }
  const startParam = searchParams.get('periodStart') ?? searchParams.get('from');
  const endParam = searchParams.get('periodEnd') ?? searchParams.get('to');
  const fromDate = startParam ? parseDate(startParam) : null;
  const toDate = endParam ? parseDate(endParam) : null;
  if (startParam && !fromDate) {
    return withIdNoStore(badRequest('periodStart invalide.'), requestId);
  }
  if (endParam && !toDate) {
    return withIdNoStore(badRequest('periodEnd invalide.'), requestId);
  }
  const aggregate = searchParams.get('aggregate') === '1';
  const categoryParam = searchParams.get('category')?.trim();
  const categoryReferenceIdParam = searchParams.get('categoryReferenceId');
  const categoryReferenceId = categoryReferenceIdParam ? parseId(categoryReferenceIdParam) : null;
  if (categoryReferenceIdParam && !categoryReferenceId) {
    return withIdNoStore(badRequest('categoryReferenceId invalide.'), requestId);
  }
  const tagReferenceIdParam = searchParams.get('tagReferenceId');
  const tagReferenceId = tagReferenceIdParam ? parseId(tagReferenceIdParam) : null;
  if (tagReferenceIdParam && !tagReferenceId) {
    return withIdNoStore(badRequest('tagReferenceId invalide.'), requestId);
  }

  const where = {
    businessId: businessIdBigInt,
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

    return withIdNoStore(
      jsonNoStore({
        incomeCents: income.toString(),
        expenseCents: expense.toString(),
        netCents: (income - expense).toString(),
      }),
      requestId
    );
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

  return withIdNoStore(
    jsonNoStore({
      items: finances.map(serializeFinance),
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/finances
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;

  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const delegateError = ensureFinanceDelegate(requestId);
  if (delegateError) return delegateError;

  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) {
    return withIdNoStore(badRequest('businessId invalide.'), requestId);
  }

  const business = await prisma.business.findUnique({ where: { id: businessIdBigInt } });
  if (!business) return withIdNoStore(notFound('Entreprise introuvable.'), requestId);

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:finances:create:${businessIdBigInt}:${userId}`,
    limit: 200,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const typeRaw = (body as { type?: unknown }).type;
  if (!isValidType(typeRaw)) {
    return withIdNoStore(badRequest('type invalide.'), requestId);
  }

  const amountCents = parseAmountCents((body as { amount?: unknown }).amount);
  if (amountCents === null) {
    return withIdNoStore(badRequest('amount invalide.'), requestId);
  }

  const categoryRaw = (body as { category?: unknown }).category;
  if (typeof categoryRaw !== 'string' || !categoryRaw.trim()) {
    return withIdNoStore(badRequest('category requise.'), requestId);
  }
  const category = categoryRaw.trim();

  const dateParsed = parseDate((body as { date?: unknown }).date);
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

  const finance = await prisma.finance.create({
    data: {
      businessId: businessIdBigInt,
      projectId,
      type: typeRaw,
      amountCents,
      category,
      date: dateParsed,
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

  return withIdNoStore(jsonNoStore({ item: serializeFinance(finance) }, { status: 201 }), requestId);
}
