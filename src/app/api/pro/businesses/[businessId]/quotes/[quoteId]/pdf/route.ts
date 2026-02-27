import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { buildQuotePdf } from '@/server/pdf/quotePdf';
import {
  buildClientSnapshot,
  buildIssuerSnapshot,
  coerceClientSnapshot,
  coerceIssuerSnapshot,
} from '@/server/billing/snapshots';

// GET /api/pro/businesses/{businessId}/quotes/{quoteId}/pdf
export const GET = withBusinessRoute<{ businessId: string; quoteId: string }>(
  { minRole: 'VIEWER' },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const quoteId = params?.quoteId;
    if (!quoteId || !/^\d+$/.test(quoteId)) return badRequest('quoteId invalide.');
    const quoteIdBigInt = BigInt(quoteId);

    const quote = await prisma.quote.findFirst({
      where: { id: quoteIdBigInt, businessId: businessIdBigInt },
      include: {
        items: { orderBy: { id: 'asc' } },
        project: { select: { name: true, prestationsText: true } },
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
    if (!quote) return notFound('Devis introuvable.');

    const issuerSnapshot =
      coerceIssuerSnapshot(quote.issuerSnapshotJson) ??
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
      });

    const clientSnapshot =
      coerceClientSnapshot(quote.clientSnapshotJson) ??
      buildClientSnapshot(
        quote.client
          ? {
              name: quote.client.name ?? null,
              companyName: quote.client.companyName ?? null,
              email: quote.client.email ?? null,
              phone: quote.client.phone ?? null,
              address: quote.client.address ?? null,
              billingCompanyName: quote.client.billingCompanyName ?? null,
              billingContactName: quote.client.billingContactName ?? null,
              billingEmail: quote.client.billingEmail ?? null,
              billingPhone: quote.client.billingPhone ?? null,
              billingVatNumber: quote.client.billingVatNumber ?? null,
              billingReference: quote.client.billingReference ?? null,
              billingAddressLine1: quote.client.billingAddressLine1 ?? null,
              billingAddressLine2: quote.client.billingAddressLine2 ?? null,
              billingPostalCode: quote.client.billingPostalCode ?? null,
              billingCity: quote.client.billingCity ?? null,
              billingCountryCode: quote.client.billingCountryCode ?? null,
            }
          : null
      );

    const pdf = await buildQuotePdf({
      quoteId: quote.id.toString(),
      number: quote.number,
      businessName: quote.business.name,
      business: issuerSnapshot,
      client: clientSnapshot,
      projectName: quote.project.name,
      prestationsText: quote.prestationsSnapshotText ?? quote.project.prestationsText ?? null,
      clientName: quote.client?.name ?? null,
      clientEmail: quote.client?.email ?? null,
      issuedAt: quote.issuedAt ? quote.issuedAt.toISOString() : quote.createdAt.toISOString(),
      expiresAt: quote.expiresAt ? quote.expiresAt.toISOString() : null,
      depositPercent: quote.depositPercent,
      totalCents: quote.totalCents.toString(),
      depositCents: quote.depositCents.toString(),
      balanceCents: quote.balanceCents.toString(),
      currency: quote.currency,
      vatEnabled: quote.business.settings?.vatEnabled ?? null,
      vatRatePercent: quote.business.settings?.vatRatePercent ?? null,
      paymentTermsDays: quote.business.settings?.paymentTermsDays ?? null,
      note: quote.note ?? null,
      requestId,
      items: quote.items.map((item) => ({
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

    // Binary PDF response — x-request-id set manually (not a JSON response)
    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quote-${quote.number ?? quote.id}.pdf"`,
        'x-request-id': requestId,
      },
    });
  }
);
