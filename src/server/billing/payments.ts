import { Prisma, InvoiceStatus, PaymentMethod } from '@/generated/prisma';
import { prisma } from '@/server/db/client';

export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export type InvoicePaymentSummary = {
  paidCents: bigint;
  remainingCents: bigint;
  status: PaymentStatus;
  lastPaidAt: Date | null;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

type InvoiceLike = {
  id: bigint;
  businessId: bigint;
  projectId: bigint;
  clientId: bigint | null;
  createdByUserId?: bigint | null;
  status: InvoiceStatus;
  totalCents: bigint;
  paidAt: Date | null;
};

type PaymentAggregate = {
  paidCents: bigint;
  count: number;
  lastPaidAt: Date | null;
};

export function deriveInvoicePaymentSummary(
  invoice: InvoiceLike,
  aggregate?: PaymentAggregate | null
): InvoicePaymentSummary {
  let paidCents = aggregate?.paidCents ?? BigInt(0);
  let lastPaidAt = aggregate?.lastPaidAt ?? null;
  const hasPayments = Boolean(aggregate && aggregate.count > 0);

  if (!hasPayments && paidCents === BigInt(0) && invoice.status === InvoiceStatus.PAID && invoice.paidAt) {
    paidCents = invoice.totalCents;
    lastPaidAt = invoice.paidAt;
  }

  const remainingCents = invoice.totalCents > paidCents ? invoice.totalCents - paidCents : BigInt(0);
  const status: PaymentStatus =
    paidCents <= BigInt(0)
      ? 'UNPAID'
      : paidCents >= invoice.totalCents
        ? 'PAID'
        : 'PARTIAL';

  return { paidCents, remainingCents, status, lastPaidAt };
}

export async function ensureLegacyPaymentForPaidInvoice(
  db: DbClient,
  invoice: InvoiceLike
): Promise<void> {
  if (invoice.status !== InvoiceStatus.PAID || !invoice.paidAt) return;
  const existing = await db.payment.findFirst({
    where: { invoiceId: invoice.id, deletedAt: null },
    select: { id: true },
  });
  if (existing) return;
  await db.payment.create({
    data: {
      businessId: invoice.businessId,
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      clientId: invoice.clientId ?? undefined,
      createdByUserId: invoice.createdByUserId ?? undefined,
      amountCents: invoice.totalCents,
      paidAt: invoice.paidAt,
      method: PaymentMethod.OTHER,
      note: 'Legacy paidAt backfill',
    },
  });
}

export async function computeInvoicePaymentSummary(
  db: DbClient,
  invoice: InvoiceLike
): Promise<InvoicePaymentSummary> {
  const agg = await db.payment.aggregate({
    where: { invoiceId: invoice.id, deletedAt: null },
    _sum: { amountCents: true },
    _count: { _all: true },
    _max: { paidAt: true },
  });
  return deriveInvoicePaymentSummary(invoice, {
    paidCents: agg._sum.amountCents ?? BigInt(0),
    count: agg._count._all ?? 0,
    lastPaidAt: agg._max.paidAt ?? null,
  });
}

export function applyPayment(
  invoiceTotal: bigint,
  paidCents: bigint
): { paidCents: bigint; remainingCents: bigint; status: PaymentStatus } {
  const remainingCents = invoiceTotal > paidCents ? invoiceTotal - paidCents : BigInt(0);
  const status: PaymentStatus =
    paidCents <= BigInt(0)
      ? 'UNPAID'
      : paidCents >= invoiceTotal
        ? 'PAID'
        : 'PARTIAL';
  return { paidCents, remainingCents, status };
}
