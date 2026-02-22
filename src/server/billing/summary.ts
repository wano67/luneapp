import { prisma } from '@/server/db/client';
import { InvoiceStatus, QuoteStatus } from '@/generated/prisma';
import { computeProjectPricing } from '@/server/services/pricing';

export type BillingSummary = {
  projectId: bigint;
  businessId: bigint;
  clientId: bigint | null;
  currency: string;
  source: 'QUOTE' | 'PRICING';
  referenceQuoteId: bigint | null;
  totalCents: bigint;
  depositPercent: number;
  depositCents: bigint;
  balanceCents: bigint;
  alreadyInvoicedCents: bigint;
  alreadyPaidCents: bigint;
  remainingCents: bigint;
};

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

  const [invoicedAgg, paidAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        businessId,
        projectId,
        status: { not: InvoiceStatus.CANCELLED },
      },
      _sum: { totalCents: true },
    }),
    prisma.invoice.aggregate({
      where: {
        businessId,
        projectId,
        status: InvoiceStatus.PAID,
      },
      _sum: { totalCents: true },
    }),
  ]);

  const alreadyInvoicedCents = invoicedAgg._sum.totalCents ?? BigInt(0);
  const alreadyPaidCents = paidAgg._sum.totalCents ?? BigInt(0);
  const remainingCents = totalCents > alreadyInvoicedCents ? totalCents - alreadyInvoicedCents : BigInt(0);

  return {
    projectId,
    businessId,
    clientId,
    currency,
    source: referenceQuote ? 'QUOTE' : 'PRICING',
    referenceQuoteId: referenceQuote?.id ?? null,
    totalCents,
    depositPercent,
    depositCents,
    balanceCents,
    alreadyInvoicedCents,
    alreadyPaidCents,
    remainingCents,
  };
}
