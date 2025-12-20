import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { FinanceType, InvoiceStatus } from '@/generated/prisma/client';
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

type InvoiceWithItems = NonNullable<
  Awaited<ReturnType<typeof prisma.invoice.findFirst>>
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

function serializeInvoice(invoice: InvoiceWithItems) {
  if (!invoice) return null;
  return {
    id: invoice.id.toString(),
    businessId: invoice.businessId.toString(),
    projectId: invoice.projectId.toString(),
    clientId: invoice.clientId ? invoice.clientId.toString() : null,
    quoteId: invoice.quoteId ? invoice.quoteId.toString() : null,
    status: invoice.status,
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
    items: invoice.items.map((item) => ({
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

// GET /api/pro/businesses/{businessId}/invoices/{invoiceId}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; invoiceId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, invoiceId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const invoiceIdBigInt = parseId(invoiceId);
  if (!businessIdBigInt || !invoiceIdBigInt) {
    return withIdNoStore(badRequest('businessId ou invoiceId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
    include: { items: true },
  });
  if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ invoice: serializeInvoice(invoice as InvoiceWithItems) }), requestId);
}

// PATCH /api/pro/businesses/{businessId}/invoices/{invoiceId}
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; invoiceId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, invoiceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const invoiceIdBigInt = parseId(invoiceId);
  if (!businessIdBigInt || !invoiceIdBigInt) {
    return withIdNoStore(badRequest('businessId ou invoiceId invalide.'), requestId);
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
    key: `pro:invoices:update:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return withIdNoStore(badRequest('Payload invalide.'), requestId);
  }

  const statusRaw = (body as { status?: unknown }).status;
  if (typeof statusRaw !== 'string' || !(Object.values(InvoiceStatus) as string[]).includes(statusRaw)) {
    return withIdNoStore(badRequest('status invalide.'), requestId);
  }
  const nextStatus = statusRaw as InvoiceStatus;

  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
    include: { items: true },
  });
  if (!existing) return withIdNoStore(notFound('Facture introuvable.'), requestId);

  const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
    [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
    [InvoiceStatus.PAID]: [],
    [InvoiceStatus.CANCELLED]: [],
  };

  if (existing.status === nextStatus) {
    return withIdNoStore(jsonNoStore({ invoice: serializeInvoice(existing) }), requestId);
  }

  const allowed = transitions[existing.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return withIdNoStore(badRequest('Transition de statut refusée.'), requestId);
  }

  const now = new Date();
  const data: Record<string, unknown> = { status: nextStatus };
  if (nextStatus === InvoiceStatus.SENT && !existing.issuedAt) data.issuedAt = now;
  if (nextStatus === InvoiceStatus.PAID) data.paidAt = now;

  const updated = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.update({
      where: { id: existing.id },
      data,
      include: { items: true },
    });

    if (existing.status !== InvoiceStatus.PAID && nextStatus === InvoiceStatus.PAID) {
      const paidAt = invoice.paidAt ?? now;
      await tx.finance.create({
        data: {
          businessId: invoice.businessId,
          projectId: invoice.projectId,
          type: FinanceType.INCOME,
          amountCents: invoice.totalCents,
          category: 'PAYMENT',
          date: paidAt,
          note: JSON.stringify({
            source: 'invoice',
            invoiceId: invoice.id.toString(),
            quoteId: invoice.quoteId ? invoice.quoteId.toString() : undefined,
            businessId: invoice.businessId.toString(),
            projectId: invoice.projectId.toString(),
            method: 'manual',
          }),
        },
      });
    }

    return invoice;
  });

  return withIdNoStore(jsonNoStore({ invoice: serializeInvoice(updated as InvoiceWithItems) }), requestId);
}
