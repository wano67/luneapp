import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BillingUnit, DiscountType, QuoteStatus } from '@/generated/prisma';
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
import { buildClientSnapshot, buildIssuerSnapshot } from '@/server/billing/snapshots';

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
      description: item.description,
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
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!quote) return withIdNoStore(notFound('Devis introuvable.'), requestId);

  return withIdNoStore(jsonNoStore({ quote: serializeQuote(quote as QuoteWithItems) }), requestId);
}

function parseIsoDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function roundPercent(amount: bigint, percent: number) {
  return (amount * BigInt(Math.round(percent))) / BigInt(100);
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

  const existing = await prisma.quote.findFirst({
    where: { id: quoteIdBigInt, businessId: businessIdBigInt },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  if (!existing) return withIdNoStore(notFound('Devis introuvable.'), requestId);

  const statusRaw = (body as { status?: unknown }).status;
  const hasStatus = statusRaw !== undefined;
  if (hasStatus) {
    if (typeof statusRaw !== 'string' || !(Object.values(QuoteStatus) as string[]).includes(statusRaw)) {
      return withIdNoStore(badRequest('status invalide.'), requestId);
    }
  }
  const nextStatus = hasStatus ? (statusRaw as QuoteStatus) : existing.status;

  const noteRaw = (body as { note?: unknown }).note;
  const issuedAtRaw = (body as { issuedAt?: unknown }).issuedAt;
  const expiresAtRaw = (body as { expiresAt?: unknown }).expiresAt;
  const itemsRaw = (body as { items?: unknown }).items;

  const wantsItemsUpdate = itemsRaw !== undefined;
  const wantsMetaUpdate = noteRaw !== undefined || issuedAtRaw !== undefined || expiresAtRaw !== undefined;
  const hasAnyChange = hasStatus || wantsItemsUpdate || wantsMetaUpdate;

  if (!hasAnyChange) {
    return withIdNoStore(badRequest('Aucune modification.'), requestId);
  }

  if (
    (existing.status === QuoteStatus.SIGNED ||
      existing.status === QuoteStatus.CANCELLED ||
      existing.status === QuoteStatus.EXPIRED) &&
    (wantsItemsUpdate || wantsMetaUpdate)
  ) {
    return withIdNoStore(badRequest('Devis signé/annulé: modification interdite.'), requestId);
  }

  if (wantsItemsUpdate && existing.status !== QuoteStatus.DRAFT) {
    return withIdNoStore(badRequest('Modification des lignes uniquement en brouillon.'), requestId);
  }

  const transitions: Record<QuoteStatus, QuoteStatus[]> = {
    [QuoteStatus.DRAFT]: [QuoteStatus.SENT, QuoteStatus.CANCELLED],
    [QuoteStatus.SENT]: [QuoteStatus.SIGNED, QuoteStatus.CANCELLED, QuoteStatus.EXPIRED],
    [QuoteStatus.SIGNED]: [],
    [QuoteStatus.CANCELLED]: [],
    [QuoteStatus.EXPIRED]: [],
  };

  if (existing.status !== nextStatus) {
    const allowed = transitions[existing.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      return withIdNoStore(badRequest('Transition de statut refusée.'), requestId);
    }
  }

  const data: Record<string, unknown> = {};

  if (hasStatus) data.status = nextStatus;

  if (noteRaw !== undefined) {
    if (noteRaw !== null && typeof noteRaw !== 'string') {
      return withIdNoStore(badRequest('note invalide.'), requestId);
    }
    const note = typeof noteRaw === 'string' ? noteRaw.trim() : null;
    if (note && note.length > 2000) return withIdNoStore(badRequest('note trop longue.'), requestId);
    data.note = note || null;
  }

  if (issuedAtRaw !== undefined) {
    const issuedAt = parseIsoDate(issuedAtRaw);
    if (issuedAtRaw !== null && !issuedAt) return withIdNoStore(badRequest('issuedAt invalide.'), requestId);
    data.issuedAt = issuedAt;
  }

  if (expiresAtRaw !== undefined) {
    const expiresAt = parseIsoDate(expiresAtRaw);
    if (expiresAtRaw !== null && !expiresAt) return withIdNoStore(badRequest('expiresAt invalide.'), requestId);
    data.expiresAt = expiresAt;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (wantsItemsUpdate) {
      if (!Array.isArray(itemsRaw)) return null;
      if (itemsRaw.length === 0) return null;
      const existingItemsById = new Map(
        existing.items.map((item) => [item.id.toString(), item])
      );
      const items: Array<{
        serviceId: bigint | null;
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
      const serviceIds: bigint[] = [];
      for (const raw of itemsRaw) {
        if (!raw || typeof raw !== 'object') return null;
        const idRaw = (raw as { id?: unknown }).id;
        const existingItem = typeof idRaw === 'string' ? existingItemsById.get(idRaw) : undefined;
        const label = typeof (raw as { label?: unknown }).label === 'string' ? (raw as { label?: string }).label!.trim() : '';
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
        const serviceIdRaw = (raw as { serviceId?: unknown }).serviceId;
        if (!label) return null;
        const quantity =
          typeof quantityRaw === 'number' && Number.isFinite(quantityRaw) ? Math.max(1, Math.trunc(quantityRaw)) : null;
        if (quantity === null) return null;
        const unitPriceNum =
          typeof unitPriceRaw === 'number' && Number.isFinite(unitPriceRaw)
            ? Math.max(0, Math.trunc(unitPriceRaw))
            : null;
        if (unitPriceNum === null) return null;
        const serviceId =
          serviceIdRaw === null || serviceIdRaw === undefined
            ? null
            : typeof serviceIdRaw === 'string' && /^\d+$/.test(serviceIdRaw)
              ? BigInt(serviceIdRaw)
              : null;
        if (serviceIdRaw !== undefined && serviceId === null && serviceIdRaw !== null) return null;
        if (serviceId) serviceIds.push(serviceId);
        const discountTypeRaw = (raw as { discountType?: unknown }).discountType;
        let discountType: DiscountType =
          (typeof discountTypeRaw === 'string' && ['NONE', 'PERCENT', 'AMOUNT'].includes(discountTypeRaw)
            ? discountTypeRaw
            : existingItem?.discountType ?? 'NONE') as DiscountType;
        const discountValueRaw = (raw as { discountValue?: unknown }).discountValue;
        let discountValue =
          typeof discountValueRaw === 'number' && Number.isFinite(discountValueRaw)
            ? Math.trunc(discountValueRaw)
            : existingItem?.discountValue ?? null;
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

      if (serviceIds.length) {
        const services = await tx.service.findMany({
          where: { id: { in: serviceIds }, businessId: businessIdBigInt },
          select: { id: true },
        });
        if (services.length !== serviceIds.length) {
          return null;
        }
      }

      await tx.quoteItem.deleteMany({ where: { quoteId: quoteIdBigInt } });
      await tx.quoteItem.createMany({
        data: items.map((item) => ({
          quoteId: quoteIdBigInt,
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

    let issuedAt = data.issuedAt as Date | undefined;
    if (nextStatus === QuoteStatus.SENT) {
      issuedAt = issuedAt ?? existing.issuedAt ?? new Date();
      if (!existing.issuedAt || data.issuedAt) data.issuedAt = issuedAt;
      if (!existing.number) {
        const number = await assignDocumentNumber(tx, businessIdBigInt, 'QUOTE', issuedAt);
        data.number = number;
      }
      if (!existing.issuerSnapshotJson || !existing.clientSnapshotJson) {
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

      if (!existing.prestationsSnapshotText) {
        const project = await tx.project.findUnique({
          where: { id: existing.projectId },
          select: { prestationsText: true },
        });
        const text = project?.prestationsText?.trim() ?? '';
        if (text) data.prestationsSnapshotText = text;
      }
    }

    const updatedQuote = await tx.quote.update({
      where: { id: quoteIdBigInt },
      data,
      include: { items: { orderBy: { id: 'asc' } } },
    });

    return updatedQuote;
  });

  if (!updated) {
    return withIdNoStore(badRequest('items invalides.'), requestId);
  }

  return withIdNoStore(jsonNoStore({ quote: serializeQuote(updated as QuoteWithItems) }), requestId);
}

// DELETE /api/pro/businesses/{businessId}/quotes/{quoteId}
export async function DELETE(
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

  const existing = await prisma.quote.findFirst({
    where: { id: quoteIdBigInt, businessId: businessIdBigInt },
    include: { invoice: { select: { id: true } } },
  });
  if (!existing) return withIdNoStore(notFound('Devis introuvable.'), requestId);

  if (existing.invoice) {
    return withIdNoStore(badRequest('Impossible de supprimer: facture liée.'), requestId);
  }

  const deletableStatuses: QuoteStatus[] = [QuoteStatus.DRAFT, QuoteStatus.CANCELLED, QuoteStatus.EXPIRED];
  if (!deletableStatuses.includes(existing.status)) {
    return withIdNoStore(badRequest('Suppression autorisée uniquement pour les devis brouillons/annulés.'), requestId);
  }

  await prisma.quote.delete({ where: { id: existing.id } });

  return withIdNoStore(jsonNoStore({ ok: true }), requestId);
}
