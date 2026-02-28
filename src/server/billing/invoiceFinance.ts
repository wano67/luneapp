import { FinanceType, Prisma } from '@/generated/prisma';

type TxClient = Prisma.TransactionClient;

/**
 * Creates a Finance INCOME record for a fully-paid invoice, if one doesn't already exist.
 * Idempotent: safe to call multiple times for the same invoice.
 */
export async function upsertFinanceForInvoicePaid(
  tx: TxClient,
  params: {
    invoice: {
      id: bigint;
      businessId: bigint;
      projectId: bigint;
      quoteId: bigint | null;
      totalCents: bigint;
    };
    paidAt: Date;
  }
) {
  const invoiceIdStr = params.invoice.id.toString();

  const existing = await tx.finance.findFirst({
    where: {
      businessId: params.invoice.businessId,
      category: 'PAYMENT',
      deletedAt: null,
      note: { contains: `"invoiceId":"${invoiceIdStr}"` },
    },
    select: { id: true },
  });
  if (existing) return;

  await tx.finance.create({
    data: {
      businessId: params.invoice.businessId,
      projectId: params.invoice.projectId,
      type: FinanceType.INCOME,
      amountCents: params.invoice.totalCents,
      category: 'PAYMENT',
      date: params.paidAt,
      note: JSON.stringify({
        source: 'invoice',
        invoiceId: invoiceIdStr,
        ...(params.invoice.quoteId ? { quoteId: params.invoice.quoteId.toString() } : {}),
        businessId: params.invoice.businessId.toString(),
        projectId: params.invoice.projectId.toString(),
        method: 'payment',
      }),
    },
  });
}

/**
 * Soft-deletes all Finance INCOME records linked to an invoice (by invoiceId in note JSON).
 * Called when a payment deletion causes the invoice to revert from PAID to SENT.
 */
export async function softDeleteFinanceForInvoice(
  tx: TxClient,
  params: {
    businessId: bigint;
    invoiceId: bigint;
  }
) {
  const invoiceIdStr = params.invoiceId.toString();
  await tx.finance.updateMany({
    where: {
      businessId: params.businessId,
      category: 'PAYMENT',
      deletedAt: null,
      note: { contains: `"invoiceId":"${invoiceIdStr}"` },
    },
    data: { deletedAt: new Date() },
  });
}
