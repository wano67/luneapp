import { prisma } from '@/server/db/client';
import {
  BillingUnit,
  DiscountType,
  FinanceType,
  InvoiceStatus,
  InventoryReservationStatus,
  LedgerSourceType,
} from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { assignDocumentNumber } from '@/server/services/numbering';
import { buildClientSnapshot, buildIssuerSnapshot } from '@/server/billing/snapshots';
import { computeInvoicePaymentSummary, ensureLegacyPaymentForPaidInvoice } from '@/server/billing/payments';
import {
  consumeReservation,
  releaseReservation,
  upsertReservationFromInvoice,
} from '@/server/services/inventoryReservations';
import { createLedgerForInvoiceConsumption, upsertCashSaleLedgerForInvoicePaid } from '@/server/services/ledger';
import { parseCentsInput } from '@/lib/money';
import { parseIdOpt, parseDateOpt } from '@/server/http/parsers';

function roundPercent(amount: bigint, percent: number) {
  return (amount * BigInt(Math.round(percent))) / BigInt(100);
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
    description: string | null;
    discountType: DiscountType;
    discountValue: number | null;
    originalUnitPriceCents: bigint | null;
    unitLabel: string | null;
    billingUnit: BillingUnit;
    quantity: number;
    unitPriceCents: bigint;
    totalCents: bigint;
    createdAt: Date;
    updatedAt: Date;
  }[];
  reservation?: { status: InventoryReservationStatus } | null;
};

function enrichInvoice(
  invoice: InvoiceWithItems,
  opts?: {
    consumptionLedgerEntryId?: bigint | null;
    cashSaleLedgerEntryId?: bigint | null;
    paymentSummary?: { paidCents: bigint; remainingCents: bigint; status: string; lastPaidAt: Date | null };
  }
) {
  if (!invoice) return null;
  return {
    ...invoice,
    paidCents: opts?.paymentSummary?.paidCents ?? BigInt(0),
    remainingCents: opts?.paymentSummary?.remainingCents ?? invoice.totalCents,
    paymentStatus: opts?.paymentSummary?.status ?? 'UNPAID',
    lastPaidAt: opts?.paymentSummary?.lastPaidAt ?? null,
    reservationStatus: invoice.reservation?.status ?? null,
    consumptionLedgerEntryId: opts?.consumptionLedgerEntryId ?? null,
    cashSaleLedgerEntryId: opts?.cashSaleLedgerEntryId ?? null,
  };
}

async function loadInvoiceLedgerIds(businessId: bigint, invoiceId: bigint) {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      businessId,
      sourceId: invoiceId,
      sourceType: {
        in: [LedgerSourceType.INVOICE_STOCK_CONSUMPTION, LedgerSourceType.INVOICE_CASH_SALE],
      },
    },
    select: { id: true, sourceType: true },
  });
  const consumption = entries.find((e) => e.sourceType === LedgerSourceType.INVOICE_STOCK_CONSUMPTION);
  const cashSale = entries.find((e) => e.sourceType === LedgerSourceType.INVOICE_CASH_SALE);
  return {
    consumptionLedgerEntryId: consumption?.id ?? null,
    cashSaleLedgerEntryId: cashSale?.id ?? null,
  };
}

// GET /api/pro/businesses/{businessId}/invoices/{invoiceId}
export const GET = withBusinessRoute<{ businessId: string; invoiceId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const invoiceIdBigInt = parseIdOpt(params.invoiceId);
    if (!invoiceIdBigInt) return withIdNoStore(badRequest('invoiceId invalide.'), requestId);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
      include: { items: { orderBy: { id: 'asc' } }, reservation: { select: { status: true } } },
    });
    if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);

    await ensureLegacyPaymentForPaidInvoice(prisma, invoice);
    const paymentSummary = await computeInvoicePaymentSummary(prisma, invoice);
    const ledgerIds = await loadInvoiceLedgerIds(businessIdBigInt, invoiceIdBigInt);

    return jsonb({ item: enrichInvoice(invoice as InvoiceWithItems, { ...ledgerIds, paymentSummary }) }, requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/invoices/{invoiceId}
export const PATCH = withBusinessRoute<{ businessId: string; invoiceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:invoices:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const invoiceIdBigInt = parseIdOpt(params.invoiceId);
    if (!invoiceIdBigInt) return withIdNoStore(badRequest('invoiceId invalide.'), requestId);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return withIdNoStore(badRequest('Payload invalide.'), requestId);
    }

    const noteRaw = (body as { note?: unknown }).note;
    const issuedAtRaw = (body as { issuedAt?: unknown }).issuedAt;
    const dueAtRaw = (body as { dueAt?: unknown }).dueAt;
    const paidAtRaw = (body as { paidAt?: unknown }).paidAt;
    const lineItemsRaw = (body as { lineItems?: unknown }).lineItems;

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
    const hasStatus = statusRaw !== undefined;
    if (hasStatus) {
      if (typeof statusRaw !== 'string' || !(Object.values(InvoiceStatus) as string[]).includes(statusRaw)) {
        return withIdNoStore(badRequest('status invalide.'), requestId);
      }
    }
    const nextStatus = hasStatus ? (statusRaw as InvoiceStatus) : InvoiceStatus.DRAFT;

    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
      include: { items: { orderBy: { id: 'asc' } }, reservation: { select: { status: true } } },
    });
    if (!existing) return withIdNoStore(notFound('Facture introuvable.'), requestId);

    const hasLineUpdates = lineItemsRaw !== undefined;
    const hasMetaUpdates = noteRaw !== undefined || issuedAtRaw !== undefined || dueAtRaw !== undefined;
    const wantsPaidAt = paidAtRaw !== undefined;
    const hasAnyChange = hasStatus || itemUpdates.length > 0 || hasLineUpdates || hasMetaUpdates || wantsPaidAt;
    if (!hasAnyChange) {
      return withIdNoStore(badRequest('Aucune modification.'), requestId);
    }

    const effectiveNextStatus = hasStatus ? nextStatus : existing.status;

    if (wantsPaidAt && paidAtRaw !== null && effectiveNextStatus !== InvoiceStatus.PAID) {
      return withIdNoStore(badRequest('paidAt requiert status=PAID.'), requestId);
    }

    if (effectiveNextStatus === InvoiceStatus.PAID || (wantsPaidAt && paidAtRaw !== null)) {
      const paymentSummary = await computeInvoicePaymentSummary(prisma, existing);
      if (paymentSummary.remainingCents > BigInt(0)) {
        return withIdNoStore(
          badRequest('Impossible de marquer payée: un solde reste à régler.'),
          requestId
        );
      }
    }

    if (itemUpdates.length) {
      const itemIds = itemUpdates.map((i) => i.id);
      const invoiceItems = await prisma.invoiceItem.findMany({
        where: { invoiceId: invoiceIdBigInt, id: { in: itemIds } },
        select: { id: true },
      });
      if (invoiceItems.length !== itemIds.length) {
        return withIdNoStore(badRequest("Certains items n'appartiennent pas à la facture."), requestId);
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

    if (existing.status === InvoiceStatus.PAID) {
      if (effectiveNextStatus !== InvoiceStatus.PAID || itemUpdates.length > 0 || hasLineUpdates || hasMetaUpdates) {
        return withIdNoStore(badRequest('Facture payée: modification interdite.'), requestId);
      }
      if (!wantsPaidAt) {
        await ensureLegacyPaymentForPaidInvoice(prisma, existing);
        const paymentSummary = await computeInvoicePaymentSummary(prisma, existing);
        const ledgerIds = await loadInvoiceLedgerIds(businessIdBigInt, invoiceIdBigInt);
        return jsonb({ item: enrichInvoice(existing as InvoiceWithItems, { ...ledgerIds, paymentSummary }) }, requestId);
      }
    }

    if (hasLineUpdates && existing.status !== InvoiceStatus.DRAFT) {
      return withIdNoStore(badRequest('Modification des lignes uniquement en brouillon.'), requestId);
    }

    const transitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELLED],
      [InvoiceStatus.SENT]: [InvoiceStatus.PAID, InvoiceStatus.CANCELLED],
      [InvoiceStatus.PAID]: [],
      [InvoiceStatus.CANCELLED]: [],
    };

    if (existing.status === effectiveNextStatus && itemUpdates.length === 0 && !hasLineUpdates && !hasMetaUpdates) {
      await ensureLegacyPaymentForPaidInvoice(prisma, existing);
      const paymentSummary = await computeInvoicePaymentSummary(prisma, existing);
      const ledgerIds = await loadInvoiceLedgerIds(businessIdBigInt, invoiceIdBigInt);
      return jsonb({ item: enrichInvoice(existing as InvoiceWithItems, { ...ledgerIds, paymentSummary }) }, requestId);
    }

    const allowed = transitions[existing.status] ?? [];
    if (existing.status !== effectiveNextStatus && !allowed.includes(effectiveNextStatus)) {
      return withIdNoStore(badRequest('Transition de statut refusée.'), requestId);
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const data: Record<string, unknown> = {};
      if (hasLineUpdates) {
        if (!Array.isArray(lineItemsRaw) || lineItemsRaw.length === 0) return null;
        const existingItemsById = new Map(
          existing.items.map((item) => [item.id.toString(), item])
        );
        const items: Array<{
          serviceId: bigint | null;
          productId: bigint | null;
          label: string;
          description: string | null;
          discountType: DiscountType;
          discountValue: number | null;
          originalUnitPriceCents: bigint | null;
          unitLabel: string | null;
          billingUnit: BillingUnit;
          quantity: number;
          unitPriceCents: bigint;
          totalCents: bigint;
        }> = [];
        const productIds: bigint[] = [];
        const serviceIds: bigint[] = [];
        for (const raw of lineItemsRaw) {
          if (!raw || typeof raw !== 'object') return null;
          const idRaw = (raw as { id?: unknown }).id;
          const existingItem = typeof idRaw === 'string' ? existingItemsById.get(idRaw) : undefined;
          const label =
            typeof (raw as { label?: unknown }).label === 'string' ? (raw as { label?: string }).label!.trim() : '';
          const descriptionRaw = (raw as { description?: unknown }).description;
          const description =
            descriptionRaw === null || descriptionRaw === undefined
              ? null
              : typeof descriptionRaw === 'string'
                ? descriptionRaw.trim()
                : null;
          if (description && description.length > 2000) return null;
          const quantityRaw = (raw as { quantity?: unknown }).quantity;
          const unitPriceRaw = (raw as { unitPriceCents?: unknown }).unitPriceCents;
          const productIdRaw = (raw as { productId?: unknown }).productId;
          const serviceIdRaw = (raw as { serviceId?: unknown }).serviceId;
          if (!label) return null;
          const quantity =
            typeof quantityRaw === 'number' && Number.isFinite(quantityRaw) ? Math.max(1, Math.trunc(quantityRaw)) : null;
          if (quantity === null) return null;
          const parsedUnit = unitPriceRaw !== undefined ? parseCentsInput(unitPriceRaw) : null;
          const unitPriceNum = parsedUnit != null ? Math.max(0, Math.trunc(parsedUnit)) : null;
          if (unitPriceNum === null) return null;
          const productId =
            productIdRaw === null || productIdRaw === undefined
              ? null
              : typeof productIdRaw === 'string' && /^\d+$/.test(productIdRaw)
                ? BigInt(productIdRaw)
                : null;
          if (productIdRaw !== undefined && productId === null && productIdRaw !== null) return null;
          const serviceId =
            serviceIdRaw === null || serviceIdRaw === undefined
              ? null
              : typeof serviceIdRaw === 'string' && /^\d+$/.test(serviceIdRaw)
                ? BigInt(serviceIdRaw)
                : null;
          if (serviceIdRaw !== undefined && serviceId === null && serviceIdRaw !== null) return null;
          if (productId) productIds.push(productId);
          if (serviceId) serviceIds.push(serviceId);
          const discountTypeRaw = (raw as { discountType?: unknown }).discountType;
          let discountType: DiscountType =
            (typeof discountTypeRaw === 'string' && ['NONE', 'PERCENT', 'AMOUNT'].includes(discountTypeRaw)
              ? discountTypeRaw
              : existingItem?.discountType ?? 'NONE') as DiscountType;
          const discountValueRaw = (raw as { discountValue?: unknown }).discountValue;
          let discountValue = existingItem?.discountValue ?? null;
          if (discountType === 'PERCENT') {
            if (typeof discountValueRaw === 'number' && Number.isFinite(discountValueRaw)) {
              discountValue = Math.min(100, Math.max(0, Math.trunc(discountValueRaw)));
            } else if (discountValueRaw !== undefined) {
              discountValue = null;
            }
          } else if (discountType === 'AMOUNT') {
            if (discountValueRaw !== undefined) {
              const parsed = parseCentsInput(discountValueRaw);
              discountValue = parsed == null ? null : Math.max(0, Math.trunc(parsed));
            }
          } else if (discountValueRaw !== undefined) {
            discountValue = null;
          }
          const originalUnitPriceRaw = (raw as { originalUnitPriceCents?: unknown }).originalUnitPriceCents;
          let originalUnitPriceCents =
            typeof originalUnitPriceRaw === 'number' && Number.isFinite(originalUnitPriceRaw)
              ? BigInt(Math.trunc(originalUnitPriceRaw))
              : existingItem?.originalUnitPriceCents ?? null;
          const unitLabelRaw = (raw as { unitLabel?: unknown }).unitLabel;
          const unitLabel =
            unitLabelRaw === null || unitLabelRaw === undefined
              ? existingItem?.unitLabel ?? null
              : typeof unitLabelRaw === 'string'
                ? unitLabelRaw.trim() || null
                : null;
          const billingUnitRaw = (raw as { billingUnit?: unknown }).billingUnit;
          const billingUnit: BillingUnit =
            (typeof billingUnitRaw === 'string' && ['ONE_OFF', 'MONTHLY'].includes(billingUnitRaw)
              ? billingUnitRaw
              : existingItem?.billingUnit ?? 'ONE_OFF') as BillingUnit;

          const unitPriceCents = BigInt(unitPriceNum);
          if (existingItem && unitPriceCents !== existingItem.unitPriceCents) {
            if (discountTypeRaw === undefined) discountType = 'NONE';
            if (discountValueRaw === undefined) discountValue = null;
            if (originalUnitPriceRaw === undefined) originalUnitPriceCents = null;
          }
          const totalCents = unitPriceCents * BigInt(quantity);
          items.push({
            productId,
            serviceId,
            label,
            description,
            discountType,
            discountValue,
            originalUnitPriceCents,
            unitLabel,
            billingUnit,
            quantity,
            unitPriceCents,
            totalCents,
          });
        }

        if (productIds.length) {
          const products = await tx.product.findMany({
            where: { id: { in: productIds }, businessId: businessIdBigInt, isArchived: false },
            select: { id: true },
          });
          if (products.length !== productIds.length) return null;
        }
        if (serviceIds.length) {
          const services = await tx.service.findMany({
            where: { id: { in: serviceIds }, businessId: businessIdBigInt },
            select: { id: true },
          });
          if (services.length !== serviceIds.length) return null;
        }

        await tx.invoiceItem.deleteMany({ where: { invoiceId: invoiceIdBigInt } });
        await tx.invoiceItem.createMany({
          data: items.map((item) => ({
            invoiceId: invoiceIdBigInt,
            productId: item.productId ?? undefined,
            serviceId: item.serviceId ?? undefined,
            label: item.label,
            description: item.description ?? undefined,
            discountType: item.discountType,
            discountValue: item.discountValue ?? undefined,
            originalUnitPriceCents: item.originalUnitPriceCents ?? undefined,
            unitLabel: item.unitLabel ?? undefined,
            billingUnit: item.billingUnit,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            totalCents: item.totalCents,
          })),
        });

        const totalCents = items.reduce((sum, item) => sum + item.totalCents, BigInt(0));
        const depositCents = roundPercent(totalCents, existing.depositPercent);
        data.totalCents = totalCents;
        data.depositCents = depositCents;
        data.balanceCents = totalCents - depositCents;
      }

      if (noteRaw !== undefined) {
        if (noteRaw !== null && typeof noteRaw !== 'string') return null;
        const note = typeof noteRaw === 'string' ? noteRaw.trim() : null;
        if (note && note.length > 2000) return null;
        data.note = note || null;
      }

      if (issuedAtRaw !== undefined) {
        const issuedAt = parseDateOpt(issuedAtRaw);
        if (issuedAtRaw !== null && !issuedAt) return null;
        data.issuedAt = issuedAt;
      }

      if (dueAtRaw !== undefined) {
        const dueAt = parseDateOpt(dueAtRaw);
        if (dueAtRaw !== null && !dueAt) return null;
        data.dueAt = dueAt;
      }

      if (paidAtRaw !== undefined) {
        if (paidAtRaw === null) {
          data.paidAt = null;
        } else {
          const paidAt = parseDateOpt(paidAtRaw);
          if (!paidAt) return null;
          data.paidAt = paidAt;
        }
      }

      if (itemUpdates.length && !hasLineUpdates) {
        for (const update of itemUpdates) {
          await tx.invoiceItem.update({
            where: { id: update.id },
            data: { productId: update.productId === null ? null : update.productId },
          });
        }
      }

      const isMarkingPaid = effectiveNextStatus === InvoiceStatus.PAID && existing.status !== InvoiceStatus.PAID;
      if (hasStatus) data.status = effectiveNextStatus;
      let issuedAt = data.issuedAt instanceof Date ? data.issuedAt : existing.issuedAt;
      if (effectiveNextStatus === InvoiceStatus.SENT && !issuedAt) issuedAt = now;
      if (effectiveNextStatus === InvoiceStatus.SENT) data.issuedAt = issuedAt;
      if (isMarkingPaid && data.paidAt === undefined) data.paidAt = now;

      if (effectiveNextStatus === InvoiceStatus.SENT && !existing.number && issuedAt) {
        const number = await assignDocumentNumber(tx, businessIdBigInt, 'INVOICE', issuedAt);
        data.number = number;
      }

      if (effectiveNextStatus === InvoiceStatus.SENT && (!existing.issuerSnapshotJson || !existing.clientSnapshotJson)) {
        const business = await tx.business.findUnique({
          where: { id: businessIdBigInt },
          select: {
            name: true,
            legalName: true,
            websiteUrl: true,
            siret: true,
            vatNumber: true,
            addressLine1: true,
            addressLine2: true,
            postalCode: true,
            city: true,
            countryCode: true,
            billingEmail: true,
            billingPhone: true,
            iban: true,
            bic: true,
            bankName: true,
            accountHolder: true,
            billingLegalText: true,
            settings: {
              select: {
                cgvText: true,
                paymentTermsText: true,
                lateFeesText: true,
                fixedIndemnityText: true,
                legalMentionsText: true,
              },
            },
          },
        });
        const client = existing.clientId
          ? await tx.client.findUnique({
              where: { id: existing.clientId },
              select: {
                name: true,
                companyName: true,
                email: true,
                phone: true,
                address: true,
                billingCompanyName: true,
                billingContactName: true,
                billingEmail: true,
                billingPhone: true,
                billingVatNumber: true,
                billingReference: true,
                billingAddressLine1: true,
                billingAddressLine2: true,
                billingPostalCode: true,
                billingCity: true,
                billingCountryCode: true,
              },
            })
          : null;

        if (business && !existing.issuerSnapshotJson) {
          data.issuerSnapshotJson = buildIssuerSnapshot({
            ...business,
            cgvText: business.settings?.cgvText ?? null,
            paymentTermsText: business.settings?.paymentTermsText ?? null,
            lateFeesText: business.settings?.lateFeesText ?? null,
            fixedIndemnityText: business.settings?.fixedIndemnityText ?? null,
            legalMentionsText: business.settings?.legalMentionsText ?? null,
          });
        }
        if (!existing.clientSnapshotJson) {
          data.clientSnapshotJson = buildClientSnapshot(client);
        }
      }

      if (effectiveNextStatus === InvoiceStatus.SENT && !existing.prestationsSnapshotText) {
        let text: string | null = null;
        if (existing.quoteId) {
          const quote = await tx.quote.findUnique({
            where: { id: existing.quoteId },
            select: { prestationsSnapshotText: true },
          });
          text = quote?.prestationsSnapshotText ?? null;
        }
        if (!text) {
          const project = await tx.project.findUnique({
            where: { id: existing.projectId },
            select: { prestationsText: true },
          });
          text = project?.prestationsText ?? null;
        }
        if (text && text.trim()) {
          data.prestationsSnapshotText = text.trim();
        }
      }

      const invoice = await tx.invoice.update({
        where: { id: existing.id },
        data,
        include: { items: { orderBy: { id: 'asc' } }, reservation: { select: { status: true } } },
      });

      if (
        existing.status === InvoiceStatus.SENT &&
        effectiveNextStatus !== InvoiceStatus.SENT &&
        effectiveNextStatus !== InvoiceStatus.PAID
      ) {
        await releaseReservation(tx, existing.id);
      }
      if (
        (existing.status === InvoiceStatus.DRAFT && effectiveNextStatus === InvoiceStatus.SENT) ||
        (existing.status === InvoiceStatus.SENT && effectiveNextStatus === InvoiceStatus.SENT)
      ) {
        await upsertReservationFromInvoice(tx, invoice as InvoiceWithItems);
      }

      if (isMarkingPaid) {
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
        const consumption = await consumeReservation(tx, { invoice: invoice as InvoiceWithItems, userId: ctx.userId });
        if (consumption.items.length) {
          await createLedgerForInvoiceConsumption(tx, {
            invoiceId: invoice.id,
            businessId: invoice.businessId,
            projectId: invoice.projectId,
            items: consumption.items,
            createdByUserId: ctx.userId,
            date: paidAt,
          });
        }
        await upsertCashSaleLedgerForInvoicePaid(tx, {
          invoice: {
            id: invoice.id,
            businessId: invoice.businessId,
            totalCents: invoice.totalCents,
            paidAt,
            number: invoice.number,
          },
          createdByUserId: ctx.userId,
        });
      }

      const refreshed = await tx.invoice.findUnique({
        where: { id: invoice.id },
        include: { items: { orderBy: { id: 'asc' } }, reservation: { select: { status: true } } },
      });

      return refreshed ?? invoice;
    });

    if (!updated) {
      return withIdNoStore(badRequest('Lignes invalides.'), requestId);
    }

    await ensureLegacyPaymentForPaidInvoice(prisma, updated as InvoiceWithItems);
    const paymentSummary = await computeInvoicePaymentSummary(prisma, updated as InvoiceWithItems);
    const ledgerIds = await loadInvoiceLedgerIds(businessIdBigInt, invoiceIdBigInt);

    return jsonb({ item: enrichInvoice(updated as InvoiceWithItems, { ...ledgerIds, paymentSummary }) }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/invoices/{invoiceId}
export const DELETE = withBusinessRoute<{ businessId: string; invoiceId: string }>(
  { minRole: 'ADMIN' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;

    const invoiceIdBigInt = parseIdOpt(params.invoiceId);
    if (!invoiceIdBigInt) return withIdNoStore(badRequest('invoiceId invalide.'), requestId);

    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
      select: { id: true, status: true },
    });
    if (!existing) return withIdNoStore(notFound('Facture introuvable.'), requestId);

    const deletableStatuses: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED];
    if (!deletableStatuses.includes(existing.status)) {
      return withIdNoStore(badRequest('Suppression autorisée uniquement pour les factures brouillons/annulées.'), requestId);
    }

    await prisma.invoice.delete({ where: { id: existing.id } });

    return jsonbNoContent(requestId);
  }
);
