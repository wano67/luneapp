import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { FinanceType } from '@/generated/prisma/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
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

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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
  type: FinanceType;
  amountCents: bigint;
  category: string;
  date: Date;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  project?: { name: string | null } | null;
}) {
  const metadata = parseMetadataFromNote(finance.note);

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
    where: { id: financeIdBigInt, businessId: businessIdBigInt },
    include: { project: { select: { name: true } } },
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

  const existing = await prisma.finance.findFirst({
    where: { id: financeIdBigInt, businessId: businessIdBigInt },
    include: { project: { select: { name: true } } },
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

  if ('amount' in body) {
    const amountCents = parseAmountCents((body as { amount?: unknown }).amount);
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

  const metadata = sanitizeMetadata((body as { metadata?: unknown }).metadata);
  if (metadata) {
    data.note = JSON.stringify(metadata);
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

  if (Object.keys(data).length === 0) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  const updated = await prisma.finance.update({
    where: { id: financeIdBigInt },
    data,
    include: { project: { select: { name: true } } },
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

  const finance = await prisma.finance.findFirst({
    where: { id: financeIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!finance) return withIdNoStore(notFound('Opération introuvable.'), requestId);

  await prisma.finance.delete({ where: { id: financeIdBigInt } });

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
