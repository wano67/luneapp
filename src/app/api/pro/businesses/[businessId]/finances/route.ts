import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { FinanceType } from '@/generated/prisma/client';
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

function serializeFinance(finance: {
  id: bigint;
  businessId: bigint;
  projectId: bigint | null;
  type: FinanceType;
  amountCents: bigint;
  category: string;
  date: Date;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { name: string | null } | null;
}) {
  return {
    id: finance.id.toString(),
    businessId: finance.businessId.toString(),
    projectId: finance.projectId ? finance.projectId.toString() : null,
    projectName: finance.project?.name ?? null,
    type: finance.type,
    amountCents: finance.amountCents.toString(),
    amount: Number(finance.amountCents) / 100,
    category: finance.category,
    date: finance.date.toISOString(),
    note: finance.note,
    createdAt: finance.createdAt.toISOString(),
    updatedAt: finance.updatedAt.toISOString(),
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
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const fromDate = fromParam ? parseDate(fromParam) : null;
  const toDate = toParam ? parseDate(toParam) : null;

  const finances = await prisma.finance.findMany({
    where: {
      businessId: businessIdBigInt,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(fromDate || toDate
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    include: {
      project: { select: { name: true } },
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

  const finance = await prisma.finance.create({
    data: {
      businessId: businessIdBigInt,
      projectId,
      type: typeRaw,
      amountCents,
      category,
      date: dateParsed,
      note,
    },
    include: {
      project: { select: { name: true } },
    },
  });

  return withIdNoStore(jsonNoStore({ item: serializeFinance(finance) }, { status: 201 }), requestId);
}
