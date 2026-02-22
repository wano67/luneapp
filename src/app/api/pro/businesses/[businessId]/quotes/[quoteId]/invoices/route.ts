import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { BillingUnit, DiscountType, InvoiceStatus, QuoteStatus } from '@/generated/prisma';
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

function serializeInvoice(
  invoice: {
    id: bigint;
    businessId: bigint;
    projectId: bigint;
    clientId: bigint | null;
    quoteId: bigint | null;
    status: InvoiceStatus;
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
  },
  opts?: { includeItems?: boolean }
) {
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
    ...(opts?.includeItems
      ? {
          items: invoice.items?.map((item) => ({
            id: item.id.toString(),
            serviceId: item.serviceId ? item.serviceId.toString() : null,
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
        }
      : {}),
  };
}

// POST /api/pro/businesses/{businessId}/quotes/{quoteId}/invoices
export async function POST(
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
    key: `pro:invoices:create:${businessIdBigInt}:${userId}`,
    limit: 50,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const existingInvoice = await prisma.invoice.findFirst({
    where: { businessId: businessIdBigInt, quoteId: quoteIdBigInt },
    select: { id: true },
  });
  if (existingInvoice) {
    return withIdNoStore(badRequest('Une facture existe déjà pour ce devis.'), requestId);
  }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteIdBigInt, businessId: businessIdBigInt },
    include: {
      items: { orderBy: { id: 'asc' } },
      project: { select: { id: true, billingQuoteId: true } },
      business: {
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
      },
      client: {
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
      },
    },
  });
  if (!quote) return withIdNoStore(notFound('Devis introuvable.'), requestId);

  if (!(quote.status === QuoteStatus.SIGNED || quote.status === QuoteStatus.SENT)) {
    return withIdNoStore(badRequest('Le devis doit être envoyé ou signé.'), requestId);
  }

  if (quote.project.billingQuoteId && quote.project.billingQuoteId !== quote.id) {
    return withIdNoStore(badRequest('Ce devis n’est pas le devis de référence du projet.'), requestId);
  }

  const dueAt = new Date();
  dueAt.setDate(dueAt.getDate() + 30);

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        businessId: businessIdBigInt,
        projectId: quote.projectId,
        clientId: quote.clientId ?? undefined,
        quoteId: quote.id,
        createdByUserId: BigInt(userId),
        status: InvoiceStatus.DRAFT,
        depositPercent: quote.depositPercent,
        currency: quote.currency,
        totalCents: quote.totalCents,
        depositCents: quote.depositCents,
        balanceCents: quote.balanceCents,
        dueAt,
        issuerSnapshotJson:
          quote.issuerSnapshotJson ??
          buildIssuerSnapshot({
            name: quote.business.name,
            legalName: quote.business.legalName,
            websiteUrl: quote.business.websiteUrl,
            siret: quote.business.siret,
            vatNumber: quote.business.vatNumber,
            addressLine1: quote.business.addressLine1,
            addressLine2: quote.business.addressLine2,
            postalCode: quote.business.postalCode,
            city: quote.business.city,
            countryCode: quote.business.countryCode,
            billingEmail: quote.business.billingEmail,
            billingPhone: quote.business.billingPhone,
            iban: quote.business.iban,
            bic: quote.business.bic,
            bankName: quote.business.bankName,
            accountHolder: quote.business.accountHolder,
            billingLegalText: quote.business.billingLegalText,
            cgvText: quote.business.settings?.cgvText ?? null,
            paymentTermsText: quote.business.settings?.paymentTermsText ?? null,
            lateFeesText: quote.business.settings?.lateFeesText ?? null,
            fixedIndemnityText: quote.business.settings?.fixedIndemnityText ?? null,
            legalMentionsText: quote.business.settings?.legalMentionsText ?? null,
          }),
        clientSnapshotJson: quote.clientSnapshotJson ?? buildClientSnapshot(quote.client) ?? undefined,
        prestationsSnapshotText: quote.prestationsSnapshotText ?? undefined,
        items: {
          create: quote.items.map((item) => ({
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
        },
      },
      include: { items: true },
    });
    return created;
  });

  const payload = serializeInvoice(invoice, { includeItems: true });
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
