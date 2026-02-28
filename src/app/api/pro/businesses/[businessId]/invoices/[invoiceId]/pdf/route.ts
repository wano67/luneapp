import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { buildInvoicePdf } from '@/server/pdf/invoicePdf';
import { computeProjectPricing } from '@/server/services/pricing';
import { InvoiceStatus, QuoteStatus } from '@/generated/prisma';
import { computeProjectBillingSummary } from '@/server/billing/summary';
import { computeInvoicePaymentSummary } from '@/server/billing/payments';
import {
  buildClientSnapshot,
  buildIssuerSnapshot,
  coerceClientSnapshot,
  coerceIssuerSnapshot,
} from '@/server/billing/snapshots';
import { parseIdOpt } from '@/server/http/parsers';

// GET /api/pro/businesses/{businessId}/invoices/{invoiceId}/pdf
export const GET = withBusinessRoute<{ businessId: string; invoiceId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { invoiceId } = await params;
    const invoiceIdBigInt = parseIdOpt(invoiceId);
    if (!invoiceIdBigInt) {
      return withIdNoStore(badRequest('invoiceId invalide.'), requestId);
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
      include: {
        items: { orderBy: { id: 'asc' } },
        project: { select: { name: true, quoteStatus: true, prestationsText: true } },
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
                paymentTermsDays: true,
                vatEnabled: true,
                vatRatePercent: true,
                cgvText: true,
                paymentTermsText: true,
                lateFeesText: true,
                fixedIndemnityText: true,
                legalMentionsText: true,
              },
            },
          },
        },
      },
    });
    if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);

    const [summary, paymentSummary, fallbackProjectTotal] = await Promise.all([
      computeProjectBillingSummary(businessIdBigInt, invoice.projectId),
      computeInvoicePaymentSummary(prisma, invoice),
      (async () => {
        if (invoice.quoteId) {
          const quote = await prisma.quote.findUnique({
            where: { id: invoice.quoteId },
            select: { totalCents: true },
          });
          if (quote) return quote.totalCents;
        }
        const signedQuote = await prisma.quote.findFirst({
          where: { businessId: businessIdBigInt, projectId: invoice.projectId, status: QuoteStatus.SIGNED },
          orderBy: { issuedAt: 'desc' },
          select: { totalCents: true },
        });
        if (signedQuote) return signedQuote.totalCents;
        if (invoice.project.quoteStatus === 'SIGNED' || invoice.project.quoteStatus === 'ACCEPTED') {
          const latest = await prisma.quote.findFirst({
            where: { businessId: businessIdBigInt, projectId: invoice.projectId },
            orderBy: { issuedAt: 'desc' },
            select: { totalCents: true },
          });
          if (latest) return latest.totalCents;
        }
        const pricing = await computeProjectPricing(businessIdBigInt, invoice.projectId);
        return pricing?.totalCents ?? null;
      })(),
    ]);

    const projectTotal = summary?.totalCents ?? fallbackProjectTotal;
    const invoicedTotal = summary?.alreadyInvoicedCents ?? null;
    const paidTotal = summary?.alreadyPaidCents ?? null;

    const alreadyInvoicedCents =
      invoicedTotal != null
        ? invoicedTotal - (invoice.status === InvoiceStatus.CANCELLED ? BigInt(0) : invoice.totalCents)
        : null;
    const alreadyPaidCents =
      paidTotal != null
        ? paidTotal - paymentSummary.paidCents >= BigInt(0)
          ? paidTotal - paymentSummary.paidCents
          : BigInt(0)
        : null;

    const remainingCents =
      projectTotal != null && alreadyInvoicedCents != null
        ? projectTotal - alreadyInvoicedCents - invoice.totalCents
        : null;

    const issuerSnapshot =
      coerceIssuerSnapshot(invoice.issuerSnapshotJson) ??
      buildIssuerSnapshot({
        name: invoice.business.name,
        legalName: invoice.business.legalName,
        websiteUrl: invoice.business.websiteUrl,
        siret: invoice.business.siret,
        vatNumber: invoice.business.vatNumber,
        addressLine1: invoice.business.addressLine1,
        addressLine2: invoice.business.addressLine2,
        postalCode: invoice.business.postalCode,
        city: invoice.business.city,
        countryCode: invoice.business.countryCode,
        billingEmail: invoice.business.billingEmail,
        billingPhone: invoice.business.billingPhone,
        iban: invoice.business.iban,
        bic: invoice.business.bic,
        bankName: invoice.business.bankName,
        accountHolder: invoice.business.accountHolder,
        billingLegalText: invoice.business.billingLegalText,
        cgvText: invoice.business.settings?.cgvText ?? null,
        paymentTermsText: invoice.business.settings?.paymentTermsText ?? null,
        lateFeesText: invoice.business.settings?.lateFeesText ?? null,
        fixedIndemnityText: invoice.business.settings?.fixedIndemnityText ?? null,
        legalMentionsText: invoice.business.settings?.legalMentionsText ?? null,
      });

    const clientSnapshot =
      coerceClientSnapshot(invoice.clientSnapshotJson) ??
      buildClientSnapshot(
        invoice.client
          ? {
              name: invoice.client.name ?? null,
              companyName: invoice.client.companyName ?? null,
              email: invoice.client.email ?? null,
              phone: invoice.client.phone ?? null,
              address: invoice.client.address ?? null,
              billingCompanyName: invoice.client.billingCompanyName ?? null,
              billingContactName: invoice.client.billingContactName ?? null,
              billingEmail: invoice.client.billingEmail ?? null,
              billingPhone: invoice.client.billingPhone ?? null,
              billingVatNumber: invoice.client.billingVatNumber ?? null,
              billingReference: invoice.client.billingReference ?? null,
              billingAddressLine1: invoice.client.billingAddressLine1 ?? null,
              billingAddressLine2: invoice.client.billingAddressLine2 ?? null,
              billingPostalCode: invoice.client.billingPostalCode ?? null,
              billingCity: invoice.client.billingCity ?? null,
              billingCountryCode: invoice.client.billingCountryCode ?? null,
            }
          : null
      );

    const pdf = await buildInvoicePdf({
      invoiceId: invoice.id.toString(),
      number: invoice.number,
      businessName: invoice.business.name,
      business: issuerSnapshot,
      client: clientSnapshot,
      projectName: invoice.project.name,
      prestationsText: invoice.prestationsSnapshotText ?? invoice.project.prestationsText ?? null,
      clientName: invoice.client?.name ?? null,
      clientEmail: invoice.client?.email ?? null,
      issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : invoice.createdAt.toISOString(),
      dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
      totalCents: invoice.totalCents.toString(),
      depositCents: invoice.depositCents.toString(),
      balanceCents: invoice.balanceCents.toString(),
      depositPercent: invoice.depositPercent,
      currency: invoice.currency,
      vatEnabled: invoice.business.settings?.vatEnabled ?? null,
      vatRatePercent: invoice.business.settings?.vatRatePercent ?? null,
      paymentTermsDays: invoice.business.settings?.paymentTermsDays ?? null,
      note: invoice.note ?? null,
      projectTotalCents: projectTotal?.toString() ?? null,
      alreadyInvoicedCents: alreadyInvoicedCents?.toString() ?? null,
      alreadyPaidCents: alreadyPaidCents?.toString() ?? null,
      remainingCents: remainingCents?.toString() ?? null,
      requestId,
      items: invoice.items.map((item) => ({
        label: item.label,
        description: item.description ?? null,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents.toString(),
        originalUnitPriceCents: item.originalUnitPriceCents?.toString() ?? null,
        unitLabel: item.unitLabel ?? null,
        billingUnit: item.billingUnit ?? null,
        totalCents: item.totalCents.toString(),
      })),
    });

    const res = new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoice.number ?? invoice.id}.pdf"`,
        'x-request-id': requestId,
      },
    });

    return res;
  }
);
