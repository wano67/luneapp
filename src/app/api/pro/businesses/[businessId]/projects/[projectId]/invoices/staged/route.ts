import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { computeProjectBillingSummary } from '@/server/billing/summary';
import { InvoiceStatus } from '@/generated/prisma';

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

function roundPercent(amount: bigint, percent: number) {
  return (amount * BigInt(Math.round(percent))) / BigInt(100);
}

type StagedMode = 'PERCENT' | 'AMOUNT' | 'FINAL';

function serializeInvoice(invoice: {
  id: bigint;
  businessId: bigint;
  projectId: bigint;
  clientId: bigint | null;
  quoteId: bigint | null;
  status: InvoiceStatus;
  number: string | null;
  depositPercent: number;
  currency: string;
  totalCents: bigint;
  depositCents: bigint;
  balanceCents: bigint;
  note: string | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: {
    id: bigint;
    serviceId: bigint | null;
    productId: bigint | null;
    label: string;
    description: string | null;
    discountType: string;
    discountValue: number | null;
    originalUnitPriceCents: bigint | null;
    unitLabel: string | null;
    billingUnit: string;
    quantity: number;
    unitPriceCents: bigint;
    totalCents: bigint;
    createdAt: Date;
    updatedAt: Date;
  }[];
}) {
  return {
    id: invoice.id.toString(),
    businessId: invoice.businessId.toString(),
    projectId: invoice.projectId.toString(),
    clientId: invoice.clientId ? invoice.clientId.toString() : null,
    quoteId: invoice.quoteId ? invoice.quoteId.toString() : null,
    status: invoice.status,
    number: invoice.number,
    depositPercent: invoice.depositPercent,
    currency: invoice.currency,
    totalCents: invoice.totalCents.toString(),
    depositCents: invoice.depositCents.toString(),
    balanceCents: invoice.balanceCents.toString(),
    note: invoice.note,
    issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : null,
    dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    items: invoice.items?.map((item) => ({
      id: item.id.toString(),
      serviceId: item.serviceId ? item.serviceId.toString() : null,
      productId: item.productId ? item.productId.toString() : null,
      label: item.label,
      description: item.description ?? null,
      discountType: item.discountType,
      discountValue: item.discountValue ?? null,
      originalUnitPriceCents: item.originalUnitPriceCents?.toString() ?? null,
      unitLabel: item.unitLabel ?? null,
      billingUnit: item.billingUnit,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents.toString(),
      totalCents: item.totalCents.toString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

// POST /api/pro/businesses/{businessId}/projects/{projectId}/invoices/staged
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
    key: `pro:invoices:staged:${businessIdBigInt}:${userId}`,
    limit: 50,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const modeRaw = (body as { mode?: unknown }).mode;
  const valueRaw = (body as { value?: unknown }).value;
  if (typeof modeRaw !== 'string' || !['PERCENT', 'AMOUNT', 'FINAL'].includes(modeRaw)) {
    return withIdNoStore(badRequest('mode invalide.'), requestId);
  }
  const mode = modeRaw as StagedMode;

  const summary = await computeProjectBillingSummary(businessIdBigInt, projectIdBigInt);
  if (!summary || summary.totalCents <= 0) {
    return withIdNoStore(badRequest('Total projet indisponible.'), requestId);
  }
  const projectTotalCents = summary.totalCents;
  const currency = summary.currency;
  const clientId = summary.clientId ?? null;
  const remaining = summary.remainingCents;
  if (remaining <= 0) {
    return withIdNoStore(badRequest('Aucun montant restant à facturer.'), requestId);
  }

  let amountCents: bigint;
  if (mode === 'FINAL') {
    amountCents = remaining;
  } else if (mode === 'PERCENT') {
    if (typeof valueRaw !== 'number' || !Number.isFinite(valueRaw)) {
      return withIdNoStore(badRequest('value invalide.'), requestId);
    }
    if (valueRaw <= 0 || valueRaw > 100) {
      return withIdNoStore(badRequest('Le pourcentage doit être entre 1 et 100.'), requestId);
    }
    amountCents = roundPercent(projectTotalCents, valueRaw);
  } else {
    if (typeof valueRaw !== 'number' || !Number.isFinite(valueRaw)) {
      return withIdNoStore(badRequest('value invalide.'), requestId);
    }
    if (valueRaw <= 0) {
      return withIdNoStore(badRequest('Le montant doit être supérieur à 0.'), requestId);
    }
    amountCents = BigInt(Math.trunc(valueRaw));
  }

  if (amountCents > remaining) {
    return withIdNoStore(badRequest('Montant supérieur au reste à facturer.'), requestId);
  }

  const dueAt = new Date();
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: businessIdBigInt },
    select: { paymentTermsDays: true },
  });
  if (settings?.paymentTermsDays) {
    dueAt.setDate(dueAt.getDate() + settings.paymentTermsDays);
  } else {
    dueAt.setDate(dueAt.getDate() + 30);
  }

  const label =
    mode === 'FINAL'
      ? 'Facture finale'
      : mode === 'PERCENT'
        ? `Situation de paiement (${valueRaw}%)`
        : 'Situation de paiement';

  const invoice = await prisma.invoice.create({
    data: {
      businessId: businessIdBigInt,
      projectId: projectIdBigInt,
      clientId: clientId ?? undefined,
      createdByUserId: BigInt(userId),
      status: InvoiceStatus.DRAFT,
      depositPercent: 0,
      currency,
      totalCents: amountCents,
      depositCents: BigInt(0),
      balanceCents: amountCents,
      dueAt,
      items: {
        create: [
          {
            label,
            description: null,
            discountType: 'NONE',
            billingUnit: 'ONE_OFF',
            quantity: 1,
            unitPriceCents: amountCents,
            totalCents: amountCents,
          },
        ],
      },
    },
    include: { items: { orderBy: { id: 'asc' } } },
  });

  const payload = serializeInvoice(invoice);
  const basePath = `/api/pro/businesses/${businessId}/invoices/${payload.id}`;

  return withIdNoStore(
    jsonNoStore(
      {
        invoice: payload,
        pdfUrl: `${basePath}/pdf`,
        downloadUrl: `${basePath}/pdf`,
      },
      { status: 201 }
    ),
    requestId
  );
}
