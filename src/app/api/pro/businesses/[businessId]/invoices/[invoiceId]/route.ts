import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import {
  FinanceType,
  InvoiceStatus,
  InventoryReservationStatus,
  LedgerSourceType,
} from '@/generated/prisma/client';
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
import {
  consumeReservation,
  releaseReservation,
  upsertReservationFromInvoice,
} from '@/server/services/inventoryReservations';
import { createLedgerForInvoiceConsumption } from '@/server/services/ledger';

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
    productId: bigint | null;
    invoiceId: bigint;
    label: string;
    quantity: number;
    unitPriceCents: bigint;
    totalCents: bigint;
    createdAt: Date;
    updatedAt: Date;
  }[];
  reservation?: { status: InventoryReservationStatus } | null;
};

function serializeInvoice(invoice: InvoiceWithItems, opts?: { consumptionLedgerEntryId?: bigint | null }) {
  if (!invoice) return null;
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
    items: invoice.items.map((item) => ({
      id: item.id.toString(),
      serviceId: item.serviceId ? item.serviceId.toString() : null,
      productId: item.productId ? item.productId.toString() : null,
      label: item.label,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents.toString(),
      totalCents: item.totalCents.toString(),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    reservationStatus: invoice.reservation?.status ?? null,
    consumptionLedgerEntryId: opts?.consumptionLedgerEntryId
      ? opts.consumptionLedgerEntryId.toString()
      : null,
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
    include: { items: true, reservation: { select: { status: true } } },
  });
  if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);

  const ledger = await prisma.ledgerEntry.findFirst({
    where: {
      businessId: businessIdBigInt,
      sourceType: LedgerSourceType.INVOICE_STOCK_CONSUMPTION,
      sourceId: invoiceIdBigInt,
    },
    select: { id: true },
  });

  return withIdNoStore(
    jsonNoStore({
      invoice: serializeInvoice(invoice as InvoiceWithItems, { consumptionLedgerEntryId: ledger?.id ?? null }),
    }),
    requestId
  );
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

  const itemsRaw = (body as { items?: unknown }).items;
  const itemUpdates: Array<{ id: bigint; productId: bigint | null }> = [];
  if (itemsRaw !== undefined) {
    if (!Array.isArray(itemsRaw)) {
      return withIdNoStore(badRequest('items doit être un tableau.'), requestId);
    }
    for (const raw of itemsRaw) {
      if (!raw || typeof raw !== 'object') {
        return withIdNoStore(badRequest('items invalide.'), requestId);
      }
      const idRaw = (raw as { id?: unknown }).id;
      const productIdRaw = (raw as { productId?: unknown }).productId;
      if (typeof idRaw !== 'string' || !/^\d+$/.test(idRaw)) {
        return withIdNoStore(badRequest('item.id invalide.'), requestId);
      }
      const productId =
        productIdRaw === null || productIdRaw === undefined
          ? null
          : typeof productIdRaw === 'string' && /^\d+$/.test(productIdRaw)
            ? BigInt(productIdRaw)
            : null;
      if (productIdRaw !== undefined && productId === null && productIdRaw !== null) {
        return withIdNoStore(badRequest('item.productId invalide.'), requestId);
      }
      itemUpdates.push({ id: BigInt(idRaw), productId });
    }
  }

  const statusRaw = (body as { status?: unknown }).status;
  if (typeof statusRaw !== 'string' || !(Object.values(InvoiceStatus) as string[]).includes(statusRaw)) {
    return withIdNoStore(badRequest('status invalide.'), requestId);
  }
  const nextStatus = statusRaw as InvoiceStatus;

  const existing = await prisma.invoice.findFirst({
    where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
    include: { items: true, reservation: { select: { status: true } } },
  });
  if (!existing) return withIdNoStore(notFound('Facture introuvable.'), requestId);

  if (itemUpdates.length) {
    const itemIds = itemUpdates.map((i) => i.id);
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: { invoiceId: invoiceIdBigInt, id: { in: itemIds } },
      select: { id: true },
    });
    if (invoiceItems.length !== itemIds.length) {
      return withIdNoStore(badRequest('Certains items n’appartiennent pas à la facture.'), requestId);
    }
    const productIds = Array.from(
      new Set(itemUpdates.map((u) => u.productId).filter((v): v is bigint => v !== null))
    );
    if (productIds.length) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }, businessId: businessIdBigInt, isArchived: false },
        select: { id: true },
      });
      if (products.length !== productIds.length) {
        return withIdNoStore(badRequest('productId doit appartenir au business.'), requestId);
      }
    }
  }

  const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
    [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
    [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
    [InvoiceStatus.PAID]: [],
    [InvoiceStatus.CANCELLED]: [],
  };

  if (existing.status === nextStatus && itemUpdates.length === 0) {
    return withIdNoStore(jsonNoStore({ invoice: serializeInvoice(existing) }), requestId);
  }

  const allowed = transitions[existing.status] ?? [];
  if (existing.status !== nextStatus && !allowed.includes(nextStatus)) {
    return withIdNoStore(badRequest('Transition de statut refusée.'), requestId);
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    if (itemUpdates.length) {
      for (const update of itemUpdates) {
        await tx.invoiceItem.update({
          where: { id: update.id },
          data: { productId: update.productId === null ? null : update.productId },
        });
      }
    }

    const data: Record<string, unknown> = { status: nextStatus };
    const issuedAt = nextStatus === InvoiceStatus.SENT ? existing.issuedAt ?? now : existing.issuedAt;
    if (nextStatus === InvoiceStatus.SENT && !existing.issuedAt) data.issuedAt = issuedAt;
    if (nextStatus === InvoiceStatus.PAID) data.paidAt = now;

    if (nextStatus === InvoiceStatus.SENT && !existing.number) {
      const number = await assignDocumentNumber(tx, businessIdBigInt, 'INVOICE', issuedAt);
      data.number = number;
    }

    const invoice = await tx.invoice.update({
      where: { id: existing.id },
      data,
      include: { items: true, reservation: { select: { status: true } } },
    });

    if (
      existing.status === InvoiceStatus.SENT &&
      nextStatus !== InvoiceStatus.SENT &&
      nextStatus !== InvoiceStatus.PAID
    ) {
      await releaseReservation(tx, existing.id);
    }
    if (
      (existing.status === InvoiceStatus.DRAFT && nextStatus === InvoiceStatus.SENT) ||
      (existing.status === InvoiceStatus.SENT && nextStatus === InvoiceStatus.SENT)
    ) {
      await upsertReservationFromInvoice(tx, invoice as InvoiceWithItems);
    }

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
      const consumption = await consumeReservation(tx, { invoice: invoice as InvoiceWithItems, userId: BigInt(userId) });
      if (consumption.items.length) {
        await createLedgerForInvoiceConsumption(tx, {
          invoiceId: invoice.id,
          businessId: invoice.businessId,
          projectId: invoice.projectId,
          items: consumption.items,
          createdByUserId: BigInt(userId),
          date: paidAt,
        });
      }
    }

    const refreshed = await tx.invoice.findUnique({
      where: { id: invoice.id },
      include: { items: true, reservation: { select: { status: true } } },
    });

    return refreshed ?? invoice;
  });

  const ledger = await prisma.ledgerEntry.findFirst({
    where: {
      businessId: businessIdBigInt,
      sourceType: LedgerSourceType.INVOICE_STOCK_CONSUMPTION,
      sourceId: invoiceIdBigInt,
    },
    select: { id: true },
  });

  return withIdNoStore(
    jsonNoStore({
      invoice: serializeInvoice(updated as InvoiceWithItems, { consumptionLedgerEntryId: ledger?.id ?? null }),
    }),
    requestId
  );
}
