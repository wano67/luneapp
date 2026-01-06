import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { QuoteStatus } from '@/generated/prisma';
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
import { computeProjectPricing } from '@/server/services/pricing';

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

function serializeQuote(
  quote: {
    id: bigint;
    businessId: bigint;
    projectId: bigint;
    clientId: bigint | null;
    status: QuoteStatus;
    number: string | null;
    depositPercent: number;
    currency: string;
    totalCents: bigint;
    depositCents: bigint;
    balanceCents: bigint;
    note: string | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items?: {
      id: bigint;
      serviceId: bigint | null;
      label: string;
      quantity: number;
      unitPriceCents: bigint;
      totalCents: bigint;
      createdAt: Date;
      updatedAt: Date;
    }[];
  },
  opts?: { includeItems?: boolean }
) {
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
    ...(opts?.includeItems
      ? {
          items: quote.items?.map((item) => ({
            id: item.id.toString(),
            serviceId: item.serviceId ? item.serviceId.toString() : null,
            label: item.label,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents.toString(),
            totalCents: item.totalCents.toString(),
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          })),
        }
      : {}),
  };
}

// GET /api/pro/businesses/{businessId}/projects/{projectId}/quotes
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, projectId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const project = await prisma.project.findFirst({
    where: { id: projectIdBigInt, businessId: businessIdBigInt },
    select: { id: true },
  });
  if (!project) return withIdNoStore(notFound('Projet introuvable.'), requestId);

  const quotes = await prisma.quote.findMany({
    where: { businessId: businessIdBigInt, projectId: projectIdBigInt },
    orderBy: { createdAt: 'desc' },
    include: { items: true },
  });

  return withIdNoStore(jsonNoStore({ items: quotes.map((q) => serializeQuote(q, { includeItems: true })) }), requestId);
}

// POST /api/pro/businesses/{businessId}/projects/{projectId}/quotes
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; projectId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, projectId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const projectIdBigInt = parseId(projectId);
  if (!businessIdBigInt || !projectIdBigInt) {
    return withIdNoStore(badRequest('businessId ou projectId invalide.'), requestId);
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
    key: `pro:quotes:create:${businessIdBigInt}:${userId}`,
    limit: 50,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const pricing = await computeProjectPricing(businessIdBigInt, projectIdBigInt);
  if (!pricing) return withIdNoStore(notFound('Projet introuvable.'), requestId);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        businessId: businessIdBigInt,
        projectId: projectIdBigInt,
        clientId: pricing.clientId ?? undefined,
        createdByUserId: BigInt(userId),
        status: QuoteStatus.DRAFT,
        depositPercent: pricing.depositPercent,
        currency: pricing.currency,
        totalCents: pricing.totalCents,
        depositCents: pricing.depositCents,
        balanceCents: pricing.balanceCents,
        expiresAt,
        items: {
          create: pricing.items.map((item) => ({
            serviceId: item.serviceId ?? undefined,
            label: item.label,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
          })),
        },
      },
      include: { items: true },
    });
    return created;
  });

  const payload = serializeQuote(quote, { includeItems: true });
  const basePath = `/api/pro/businesses/${businessId}/quotes/${payload.id}`;

  return withIdNoStore(
    jsonNoStore(
      {
        quote: payload,
        pdfUrl: `${basePath}/pdf`,
        downloadUrl: `${basePath}/pdf`,
      },
      { status: 201 }
    ),
    requestId
  );
}
