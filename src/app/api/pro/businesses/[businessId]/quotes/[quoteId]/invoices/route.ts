import { prisma } from '@/server/db/client';
import { InvoiceStatus, QuoteStatus } from '@/generated/prisma';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbCreated } from '@/server/http/json';
import { badRequest, notFound } from '@/server/http/apiUtils';
import { parseIdOpt } from '@/server/http/parsers';
import { buildClientSnapshot, buildIssuerSnapshot } from '@/server/billing/snapshots';

// POST /api/pro/businesses/{businessId}/quotes/{quoteId}/invoices
export const POST = withBusinessRoute<{ businessId: string; quoteId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:invoices:create:${ctx.businessId}:${ctx.userId}`,
      limit: 50,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _req, params) => {
    const { requestId, businessId: businessIdBigInt, userId } = ctx;
    const quoteIdBigInt = parseIdOpt(params?.quoteId);
    if (!quoteIdBigInt) return badRequest('quoteId invalide.');

    const existingInvoice = await prisma.invoice.findFirst({
      where: { businessId: businessIdBigInt, quoteId: quoteIdBigInt },
      select: { id: true },
    });
    if (existingInvoice) {
      return badRequest('Une facture existe déjà pour ce devis.');
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
    if (!quote) return notFound('Devis introuvable.');

    if (!(quote.status === QuoteStatus.SIGNED || quote.status === QuoteStatus.SENT)) {
      return badRequest('Le devis doit être envoyé ou signé.');
    }

    if (quote.project.billingQuoteId && quote.project.billingQuoteId !== quote.id) {
      return badRequest('Ce devis n\u2019est pas le devis de référence du projet.');
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
          createdByUserId: userId,
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

    const basePath = `/api/pro/businesses/${businessIdBigInt}/invoices/${invoice.id}`;

    return jsonbCreated(
      {
        item: invoice,
        pdfUrl: `${basePath}/pdf`,
        downloadUrl: `${basePath}/pdf`,
      },
      requestId
    );
  }
);
