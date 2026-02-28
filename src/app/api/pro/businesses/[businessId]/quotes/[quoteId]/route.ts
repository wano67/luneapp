import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BillingUnit, DiscountType, ProjectQuoteStatus, QuoteStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt, parseDateOpt } from '@/server/http/parsers';
import { assignDocumentNumber } from '@/server/services/numbering';
import { buildClientSnapshot, buildIssuerSnapshot } from '@/server/billing/snapshots';
import { parseCentsInput } from '@/lib/money';

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
  return {
    id: quote.id.toString(),
    businessId: quote.businessId.toString(),
    projectId: quote.projectId.toString(),
    clientId: quote.clientId ? quote.clientId.toString() : null,
    status: quote.status,
    number: quote.number,
    cancelledAt: quote.cancelledAt ? quote.cancelledAt.toISOString() : null,
    cancelReason: quote.cancelReason ?? null,
    depositPercent: quote.depositPercent,
    currency: quote.currency,
    totalCents: quote.totalCents.toString(),
    depositCents: quote.depositCents.toString(),
    balanceCents: quote.balanceCents.toString(),
    note: quote.note,
    issuedAt: quote.issuedAt ? quote.issuedAt.toISOString() : null,
    signedAt: quote.signedAt ? quote.signedAt.toISOString() : null,
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

function roundPercent(amount: bigint, percent: number) {
  return (amount * BigInt(Math.round(percent))) / BigInt(100);
}

// GET /api/pro/businesses/{businessId}/quotes/{quoteId}
export const GET = withBusinessRoute<{ businessId: string; quoteId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const quoteIdBigInt = parseIdOpt(params?.quoteId);
    if (!quoteIdBigInt) return badRequest('quoteId invalide.');

    const quote = await prisma.quote.findFirst({
      where: { id: quoteIdBigInt, businessId: businessIdBigInt },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!quote) return notFound('Devis introuvable.');

    return jsonb({ item: serializeQuote(quote as QuoteWithItems) }, requestId);
  }
);

// PATCH /api/pro/businesses/{businessId}/quotes/{quoteId}
export const PATCH = withBusinessRoute<{ businessId: string; quoteId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:quotes:update:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const quoteIdBigInt = parseIdOpt(params?.quoteId);
    if (!quoteIdBigInt) return badRequest('quoteId invalide.');

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return badRequest('Payload invalide.');
    }

    const existing = await prisma.quote.findFirst({
      where: { id: quoteIdBigInt, businessId: businessIdBigInt },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!existing) return notFound('Devis introuvable.');

    const statusRaw = (body as { status?: unknown }).status;
    const hasStatus = statusRaw !== undefined;
    if (hasStatus) {
      if (typeof statusRaw !== 'string' || !(Object.values(QuoteStatus) as string[]).includes(statusRaw)) {
        return badRequest('status invalide.');
      }
    }
    const nextStatus = hasStatus ? (statusRaw as QuoteStatus) : existing.status;

    const noteRaw = (body as { note?: unknown }).note;
    const issuedAtRaw = (body as { issuedAt?: unknown }).issuedAt;
    const signedAtRaw = (body as { signedAt?: unknown }).signedAt;
    const expiresAtRaw = (body as { expiresAt?: unknown }).expiresAt;
    const cancelReasonRaw = (body as { cancelReason?: unknown }).cancelReason;
    const itemsRaw = (body as { items?: unknown }).items;

    const wantsItemsUpdate = itemsRaw !== undefined;
    const wantsMetaUpdate = noteRaw !== undefined || issuedAtRaw !== undefined || expiresAtRaw !== undefined;
    const wantsSignedAt = signedAtRaw !== undefined;
    const wantsCancelReason = cancelReasonRaw !== undefined;
    const hasAnyChange = hasStatus || wantsItemsUpdate || wantsMetaUpdate || wantsSignedAt || wantsCancelReason;

    if (wantsSignedAt && signedAtRaw !== null && nextStatus !== QuoteStatus.SIGNED) {
      return badRequest('signedAt requiert status=SIGNED.');
    }
    if (wantsCancelReason && !hasStatus) {
      return badRequest('cancelReason requiert un changement de statut.');
    }
    if (wantsCancelReason && nextStatus !== QuoteStatus.CANCELLED) {
      return badRequest('cancelReason requiert status=CANCELLED.');
    }

    if (!hasAnyChange) {
      return badRequest('Aucune modification.');
    }

    if (
      (existing.status === QuoteStatus.SIGNED ||
        existing.status === QuoteStatus.CANCELLED ||
        existing.status === QuoteStatus.EXPIRED) &&
      (wantsItemsUpdate || wantsMetaUpdate)
    ) {
      return badRequest('Devis signé/annulé: modification interdite.');
    }

    if (wantsItemsUpdate && existing.status !== QuoteStatus.DRAFT) {
      return badRequest('Modification des lignes uniquement en brouillon.');
    }

    const transitions: Record<QuoteStatus, QuoteStatus[]> = {
      [QuoteStatus.DRAFT]: [QuoteStatus.SENT, QuoteStatus.CANCELLED],
      [QuoteStatus.SENT]: [QuoteStatus.SIGNED, QuoteStatus.CANCELLED, QuoteStatus.EXPIRED],
      [QuoteStatus.SIGNED]: [QuoteStatus.CANCELLED],
      [QuoteStatus.CANCELLED]: [],
      [QuoteStatus.EXPIRED]: [],
    };

    if (existing.status !== nextStatus) {
      const allowed = transitions[existing.status] ?? [];
      if (!allowed.includes(nextStatus)) {
        return badRequest('Transition de statut refusée.');
      }
    }

    const data: Record<string, unknown> = {};

    if (hasStatus) data.status = nextStatus;

    if (noteRaw !== undefined) {
      if (noteRaw !== null && typeof noteRaw !== 'string') {
        return badRequest('note invalide.');
      }
      const note = typeof noteRaw === 'string' ? noteRaw.trim() : null;
      if (note && note.length > 2000) return badRequest('note trop longue.');
      data.note = note || null;
    }

    if (issuedAtRaw !== undefined) {
      const issuedAt = parseDateOpt(issuedAtRaw);
      if (issuedAtRaw !== null && !issuedAt) return badRequest('issuedAt invalide.');
      data.issuedAt = issuedAt;
    }

    if (expiresAtRaw !== undefined) {
      const expiresAt = parseDateOpt(expiresAtRaw);
      if (expiresAtRaw !== null && !expiresAt) return badRequest('expiresAt invalide.');
      data.expiresAt = expiresAt;
    }

    const isCancelling = hasStatus && nextStatus === QuoteStatus.CANCELLED;
    let cancelReason: string | null = null;
    if (wantsCancelReason) {
      if (typeof cancelReasonRaw !== 'string') {
        return badRequest('cancelReason invalide.');
      }
      cancelReason = cancelReasonRaw.trim();
      if (!cancelReason) {
        return badRequest('cancelReason requis.');
      }
      if (cancelReason.length > 1000) {
        return badRequest('cancelReason trop long (1000 max).');
      }
    }
    if (isCancelling && !cancelReason) {
      return badRequest('cancelReason requis pour annuler un devis.');
    }

    if (isCancelling) {
      data.cancelReason = cancelReason;
      data.cancelledAt = new Date();
    }

    if (signedAtRaw !== undefined) {
      if (signedAtRaw === null) {
        data.signedAt = null;
      } else {
        const signedAt = parseDateOpt(signedAtRaw);
        if (!signedAt) return badRequest('signedAt invalide.');
        data.signedAt = signedAt;
      }
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
          const parsedUnit = unitPriceRaw !== undefined ? parseCentsInput(unitPriceRaw) : null;
          const unitPriceNum = parsedUnit != null ? Math.max(0, Math.trunc(parsedUnit)) : null;
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
          const originalUnitPriceCents =
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

      if (nextStatus === QuoteStatus.SIGNED) {
        const signedAt =
          data.signedAt instanceof Date
            ? data.signedAt
            : existing.signedAt ?? new Date();
        if (!existing.signedAt || data.signedAt) data.signedAt = signedAt;
      }

      const updatedQuote = await tx.quote.update({
        where: { id: quoteIdBigInt },
        data,
        include: { items: { orderBy: { id: 'asc' } } },
      });

      if (hasStatus && nextStatus === QuoteStatus.SIGNED) {
        await tx.project.update({
          where: { id: existing.projectId },
          data: {
            quoteStatus: ProjectQuoteStatus.SIGNED,
            billingQuoteId: existing.id,
          },
        });
      }

      if (hasStatus && nextStatus === QuoteStatus.CANCELLED) {
        const project = await tx.project.findUnique({
          where: { id: existing.projectId },
          select: { billingQuoteId: true },
        });
        if (project?.billingQuoteId === existing.id) {
          const replacement = await tx.quote.findFirst({
            where: {
              businessId: businessIdBigInt,
              projectId: existing.projectId,
              status: QuoteStatus.SIGNED,
              id: { not: existing.id },
            },
            orderBy: { issuedAt: 'desc' },
            select: { id: true },
          });
          await tx.project.update({
            where: { id: existing.projectId },
            data: {
              billingQuoteId: replacement?.id ?? null,
              quoteStatus: replacement ? ProjectQuoteStatus.SIGNED : ProjectQuoteStatus.DRAFT,
            },
          });
        }
      }

      return updatedQuote;
    });

    if (!updated) {
      return badRequest('items invalides.');
    }

    return jsonb({ item: serializeQuote(updated as QuoteWithItems) }, requestId);
  }
);

// DELETE /api/pro/businesses/{businessId}/quotes/{quoteId}
export const DELETE = withBusinessRoute<{ businessId: string; quoteId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:quotes:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 30,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const quoteIdBigInt = parseIdOpt(params?.quoteId);
    if (!quoteIdBigInt) return badRequest('quoteId invalide.');

    const existing = await prisma.quote.findFirst({
      where: { id: quoteIdBigInt, businessId: businessIdBigInt },
      include: { invoice: { select: { id: true } } },
    });
    if (!existing) return notFound('Devis introuvable.');

    const invoiceCount = await prisma.invoice.count({
      where: { quoteId: existing.id },
    });
    if (invoiceCount > 0 || existing.invoice) {
      return new NextResponse(
        JSON.stringify({ error: 'Impossible de supprimer: facture liée.' }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json', 'x-request-id': requestId },
        }
      );
    }

    const deletableStatuses: QuoteStatus[] = [QuoteStatus.DRAFT, QuoteStatus.CANCELLED];
    if (!deletableStatuses.includes(existing.status)) {
      return badRequest('Suppression autorisée uniquement pour les devis brouillons/annulés.');
    }

    await prisma.quote.delete({ where: { id: existing.id } });

    return jsonbNoContent(requestId);
  }
);
