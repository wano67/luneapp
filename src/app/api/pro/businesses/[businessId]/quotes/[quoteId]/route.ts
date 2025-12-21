import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { QuoteStatus } from '@/generated/prisma/client';
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
import { assignDocumentNumber } from '@/server/services/numbering';

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

type QuoteWithItems = NonNullable<
  Awaited<ReturnType<typeof prisma.quote.findFirst>>
> & {
  items: {
    id: bigint;
    serviceId: bigint | null;
    label: string;
    quantity: number;
    unitPriceCents: bigint;
    totalCents: bigint;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

function serializeQuote(quote: QuoteWithItems) {
  if (!quote) return null;
  return {
    id: quote.id.toString(),
    businessId: quote.businessId.toString(),
    projectId: quote.projectId.toString(),
    clientId: quote.clientId ? quote.clientId.toString() : null,
    status: quote.status,
    number: quote.number,
    depositPercent: quote.depositPercent,
    currency: quote.currency,
    totalCents: quote.totalCents.toString(),
    depositCents: quote.depositCents.toString(),
    balanceCents: quote.balanceCents.toString(),
    note: quote.note,
    issuedAt: quote.issuedAt ? quote.issuedAt.toISOString() : null,
    expiresAt: quote.expiresAt ? quote.expiresAt.toISOString() : null,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    items: quote.items.map((item) => ({
      id: item.id.toString(),
      serviceId: item.serviceId ? item.serviceId.toString() : null,
      label: item.label,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents.toString(),
      totalCents: item.totalCents.toString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

// GET /api/pro/businesses/{businessId}/quotes/{quoteId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; quoteId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, quoteId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const quoteIdBigInt = parseId(quoteId);
  if (!businessIdBigInt || !quoteIdBigInt) {
    return withIdNoStore(badRequest('businessId ou quoteId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const quote = await prisma.quote.findFirst({
    where: { id: quoteIdBigInt, businessId: businessIdBigInt },
    include: { items: true },
  });
  if (!quote) return withIdNoStore(notFound('Devis introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ quote: serializeQuote(quote as QuoteWithItems) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/quotes/{quoteId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; quoteId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, quoteId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const quoteIdBigInt = parseId(quoteId);
  if (!businessIdBigInt || !quoteIdBigInt) {
    return withIdNoStore(badRequest('businessId ou quoteId invalide.'), requestId);
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
    key: `pro:quotes:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const statusRaw = (body as { status?: unknown }).status;
  if (typeof statusRaw !== 'string' || !(Object.values(QuoteStatus) as string[]).includes(statusRaw)) {
    return withIdNoStore(badRequest('status invalide.'), requestId);
  }
  const nextStatus = statusRaw as QuoteStatus;

  const existing = await prisma.quote.findFirst({
    where: { id: quoteIdBigInt, businessId: businessIdBigInt },
    include: { items: true },
  });
  if (!existing) return withIdNoStore(notFound('Devis introuvable.'), requestId);

  const transitions: Record<QuoteStatus, QuoteStatus[]> = {
    [QuoteStatus.DRAFT]: [QuoteStatus.SENT, QuoteStatus.CANCELLED],
    [QuoteStatus.SENT]: [QuoteStatus.SIGNED, QuoteStatus.CANCELLED, QuoteStatus.EXPIRED],
    [QuoteStatus.SIGNED]: [],
    [QuoteStatus.CANCELLED]: [],
    [QuoteStatus.EXPIRED]: [],
  };

  if (existing.status === nextStatus) {
    return withIdNoStore(jsonNoStore({ quote: serializeQuote(existing) }), requestId);
  }

  const allowed = transitions[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return withIdNoStore(badRequest('Transition de statut refusée.'), requestId);
  }

  const data: Record<string, unknown> = { status: nextStatus };
  const updated = await prisma.$transaction(async (tx) => {
    const issuedAt = nextStatus === QuoteStatus.SENT ? existing.issuedAt ?? new Date() : existing.issuedAt;
    if (nextStatus === QuoteStatus.SENT && !existing.issuedAt) {
      data.issuedAt = issuedAt;
    }

    if (nextStatus === QuoteStatus.SENT && !existing.number) {
      const number = await assignDocumentNumber(tx, businessIdBigInt, 'QUOTE', issuedAt);
      data.number = number;
    }

    return tx.quote.update({
      where: { id: quoteIdBigInt },
      data,
      include: { items: true },
    });
  });

  return withIdNoStore(jsonNoStore({ quote: serializeQuote(updated as QuoteWithItems) }), requestId);
}
