import { prisma } from '@/server/db/client';
import { InvoiceStatus, QuoteStatus } from '@/generated/prisma';
import { computeProjectPricing } from '@/server/services/pricing';
import { deriveInvoicePaymentSummary } from '@/server/billing/payments';

export type BillingSummary = {
  projectId: bigint;
  businessId: bigint;
  clientId: bigint | null;
  currency: string;
  source: 'QUOTE' | 'PRICING';
  referenceQuoteId: bigint | null;
  plannedValueCents: bigint;
  totalCents: bigint;
  depositPercent: number;
  depositCents: bigint;
  balanceCents: bigint;
  alreadyInvoicedCents: bigint;
  alreadyPaidCents: bigint;
  remainingToCollectCents: bigint;
  remainingToInvoiceCents: bigint;
  remainingCents: bigint;
};

export function pickProjectValueCents(params: {
  billingQuoteTotal?: bigint | null;
  latestSignedTotal?: bigint | null;
  serviceTotal?: bigint | null;
}) {
  return (
    params.billingQuoteTotal ??
    params.latestSignedTotal ??
    params.serviceTotal ??
    null
  );
}

type ReferenceQuote = {
  id: bigint;
  clientId: bigint | null;
  currency: string;
  totalCents: bigint;
  depositPercent: number;
  depositCents: bigint;
  balanceCents: bigint;
};

async function resolveBillingReferenceQuote(params: {
  businessId: bigint;
  projectId: bigint;
  billingQuoteId?: bigint | null;
}): Promise<ReferenceQuote | null> {
  const { businessId, projectId, billingQuoteId } = params;
  if (billingQuoteId) {
    const byId = await prisma.quote.findFirst({
      where: {
        id: billingQuoteId,
        businessId,
        projectId,
        status: QuoteStatus.SIGNED,
      },
      select: {
        id: true,
        clientId: true,
        currency: true,
        totalCents: true,
        depositPercent: true,
        depositCents: true,
        balanceCents: true,
      },
    });
    if (byId) return byId;
  }

  return prisma.quote.findFirst({
    where: {
      businessId,
      projectId,
      status: QuoteStatus.SIGNED,
    },
    orderBy: { issuedAt: 'desc' },
    select: {
      id: true,
      clientId: true,
      currency: true,
      totalCents: true,
      depositPercent: true,
      depositCents: true,
      balanceCents: true,
    },
  });
}

export async function computeProjectBillingSummary(
  businessId: bigint,
  projectId: bigint
): Promise<BillingSummary | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, businessId },
    select: { id: true, clientId: true, billingQuoteId: true },
  });
  if (!project) return null;

  const referenceQuote = await resolveBillingReferenceQuote({
    businessId,
    projectId,
    billingQuoteId: project.billingQuoteId ?? null,
  });

  const pricing = referenceQuote ? null : await computeProjectPricing(businessId, projectId);
  if (!referenceQuote && !pricing) return null;

  const totalCents = referenceQuote?.totalCents ?? pricing!.totalCents;
  const depositPercent = referenceQuote?.depositPercent ?? pricing!.depositPercent;
  const depositCents = referenceQuote?.depositCents ?? pricing!.depositCents;
  const balanceCents = referenceQuote?.balanceCents ?? pricing!.balanceCents;
  const currency = referenceQuote?.currency ?? pricing!.currency;
  const clientId = referenceQuote?.clientId ?? pricing!.clientId ?? project.clientId ?? null;

  const invoices = await prisma.invoice.findMany({
    where: {
      businessId,
      projectId,
      status: { not: InvoiceStatus.CANCELLED },
    },
    select: {
      id: true,
      businessId: true,
      projectId: true,
      clientId: true,
      createdByUserId: true,
      totalCents: true,
      status: true,
      paidAt: true,
    },
  });

  const invoiceIds = invoices.map((inv) => inv.id);
  const paymentGroups = invoiceIds.length
    ? await prisma.payment.groupBy({
        by: ['invoiceId'],
        where: {
          businessId,
          projectId,
          deletedAt: null,
          invoiceId: { in: invoiceIds },
        },
        _sum: { amountCents: true },
        _count: { _all: true },
        _max: { paidAt: true },
      })
    : [];

  const paidByInvoice = new Map<
    bigint,
    { paidCents: bigint; count: number; lastPaidAt: Date | null }
  >();
  paymentGroups.forEach((row) => {
    paidByInvoice.set(row.invoiceId, {
      paidCents: row._sum.amountCents ?? BigInt(0),
      count: row._count._all ?? 0,
      lastPaidAt: row._max.paidAt ?? null,
    });
  });

  const alreadyInvoicedCents = invoices.reduce((sum, inv) => sum + inv.totalCents, BigInt(0));
  const alreadyPaidCents = invoices.reduce((sum, inv) => {
    const summary = deriveInvoicePaymentSummary(
      {
        id: inv.id,
        businessId: inv.businessId,
        projectId: inv.projectId,
        clientId: inv.clientId,
        createdByUserId: inv.createdByUserId,
        status: inv.status,
        totalCents: inv.totalCents,
        paidAt: inv.paidAt,
      },
      paidByInvoice.get(inv.id)
    );
    return sum + summary.paidCents;
  }, BigInt(0));
  const remainingCents = totalCents > alreadyInvoicedCents ? totalCents - alreadyInvoicedCents : BigInt(0);
  const remainingToCollectCents =
    alreadyInvoicedCents > alreadyPaidCents ? alreadyInvoicedCents - alreadyPaidCents : BigInt(0);

  return {
    projectId,
    businessId,
    clientId,
    currency,
    source: referenceQuote ? 'QUOTE' : 'PRICING',
    referenceQuoteId: referenceQuote?.id ?? null,
    plannedValueCents: totalCents,
    totalCents,
    depositPercent,
    depositCents,
    balanceCents,
    alreadyInvoicedCents,
    alreadyPaidCents,
    remainingToCollectCents,
    remainingToInvoiceCents: remainingCents,
    remainingCents,
  };
}
