import { prisma } from '@/server/db/client';
import { buildQuotePdf } from '@/server/pdf/quotePdf';
import { buildInvoicePdf } from '@/server/pdf/invoicePdf';
import {
  buildClientSnapshot,
  buildIssuerSnapshot,
  coerceClientSnapshot,
  coerceIssuerSnapshot,
} from '@/server/billing/snapshots';
import { computeProjectBillingSummary } from '@/server/billing/summary';
import { computeInvoicePaymentSummary } from '@/server/billing/payments';
import { computeProjectPricing } from '@/server/services/pricing';
import { InvoiceStatus, QuoteStatus } from '@/generated/prisma';

const BUSINESS_SELECT = {
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
} as const;

const CLIENT_SELECT = {
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
} as const;

function buildIssuer(business: {
  name: string;
  legalName: string | null;
  websiteUrl: string | null;
  siret: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  accountHolder: string | null;
  billingLegalText: string | null;
  settings: {
    cgvText: string | null;
    paymentTermsText: string | null;
    lateFeesText: string | null;
    fixedIndemnityText: string | null;
    legalMentionsText: string | null;
  } | null;
}) {
  return buildIssuerSnapshot({
    name: business.name,
    legalName: business.legalName,
    websiteUrl: business.websiteUrl,
    siret: business.siret,
    vatNumber: business.vatNumber,
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2,
    postalCode: business.postalCode,
    city: business.city,
    countryCode: business.countryCode,
    billingEmail: business.billingEmail,
    billingPhone: business.billingPhone,
    iban: business.iban,
    bic: business.bic,
    bankName: business.bankName,
    accountHolder: business.accountHolder,
    billingLegalText: business.billingLegalText,
    cgvText: business.settings?.cgvText ?? null,
    paymentTermsText: business.settings?.paymentTermsText ?? null,
    lateFeesText: business.settings?.lateFeesText ?? null,
    fixedIndemnityText: business.settings?.fixedIndemnityText ?? null,
    legalMentionsText: business.settings?.legalMentionsText ?? null,
  });
}

function buildClient(client: {
  name: string | null;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  billingCompanyName: string | null;
  billingContactName: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  billingVatNumber: string | null;
  billingReference: string | null;
  billingAddressLine1: string | null;
  billingAddressLine2: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  billingCountryCode: string | null;
} | null) {
  return buildClientSnapshot(
    client
      ? {
          name: client.name ?? null,
          companyName: client.companyName ?? null,
          email: client.email ?? null,
          phone: client.phone ?? null,
          address: client.address ?? null,
          billingCompanyName: client.billingCompanyName ?? null,
          billingContactName: client.billingContactName ?? null,
          billingEmail: client.billingEmail ?? null,
          billingPhone: client.billingPhone ?? null,
          billingVatNumber: client.billingVatNumber ?? null,
          billingReference: client.billingReference ?? null,
          billingAddressLine1: client.billingAddressLine1 ?? null,
          billingAddressLine2: client.billingAddressLine2 ?? null,
          billingPostalCode: client.billingPostalCode ?? null,
          billingCity: client.billingCity ?? null,
          billingCountryCode: client.billingCountryCode ?? null,
        }
      : null,
  );
}

function mapItems(items: Array<{
  label: string;
  description: string | null;
  quantity: number;
  unitPriceCents: bigint;
  originalUnitPriceCents: bigint | null;
  unitLabel: string | null;
  billingUnit: string | null;
  totalCents: bigint;
}>) {
  return items.map((item) => ({
    label: item.label,
    description: item.description ?? null,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents.toString(),
    originalUnitPriceCents: item.originalUnitPriceCents?.toString() ?? null,
    unitLabel: item.unitLabel ?? null,
    billingUnit: item.billingUnit ?? null,
    totalCents: item.totalCents.toString(),
  }));
}

/**
 * Fetch a quote + all related data and build the PDF.
 * Returns null if the quote is not found.
 */
export async function fetchAndBuildQuotePdf(
  quoteId: bigint,
  projectId: bigint,
  businessId: bigint,
): Promise<Uint8Array | null> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, projectId, businessId },
    include: {
      items: { orderBy: { id: 'asc' } },
      project: { select: { name: true, prestationsText: true } },
      client: { select: CLIENT_SELECT },
      business: { select: BUSINESS_SELECT },
    },
  });
  if (!quote) return null;

  const issuerSnapshot =
    coerceIssuerSnapshot(quote.issuerSnapshotJson) ?? buildIssuer(quote.business);

  const clientSnapshot =
    coerceClientSnapshot(quote.clientSnapshotJson) ?? buildClient(quote.client);

  return buildQuotePdf({
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
    items: mapItems(quote.items),
  });
}

/**
 * Fetch an invoice + all related data and build the PDF.
 * Returns null if the invoice is not found.
 */
export async function fetchAndBuildInvoicePdf(
  invoiceId: bigint,
  projectId: bigint,
  businessId: bigint,
): Promise<Uint8Array | null> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, projectId, businessId },
    include: {
      items: { orderBy: { id: 'asc' } },
      project: { select: { name: true, quoteStatus: true, prestationsText: true } },
      client: { select: CLIENT_SELECT },
      business: { select: BUSINESS_SELECT },
    },
  });
  if (!invoice) return null;

  const [summary, paymentSummary, fallbackProjectTotal] = await Promise.all([
    computeProjectBillingSummary(businessId, invoice.projectId),
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
        where: { businessId, projectId: invoice.projectId, status: QuoteStatus.SIGNED },
        orderBy: { issuedAt: 'desc' },
        select: { totalCents: true },
      });
      if (signedQuote) return signedQuote.totalCents;
      if (invoice.project.quoteStatus === 'SIGNED' || invoice.project.quoteStatus === 'ACCEPTED') {
        const latest = await prisma.quote.findFirst({
          where: { businessId, projectId: invoice.projectId },
          orderBy: { issuedAt: 'desc' },
          select: { totalCents: true },
        });
        if (latest) return latest.totalCents;
      }
      const pricing = await computeProjectPricing(businessId, invoice.projectId);
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
    coerceIssuerSnapshot(invoice.issuerSnapshotJson) ?? buildIssuer(invoice.business);

  const clientSnapshot =
    coerceClientSnapshot(invoice.clientSnapshotJson) ?? buildClient(invoice.client);

  return buildInvoicePdf({
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
    items: mapItems(invoice.items),
  });
}
