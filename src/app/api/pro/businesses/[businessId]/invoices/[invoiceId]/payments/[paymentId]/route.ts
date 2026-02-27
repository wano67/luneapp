import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbNoContent } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { InvoiceStatus } from '@/generated/prisma';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

// DELETE /api/pro/businesses/{businessId}/invoices/{invoiceId}/payments/{paymentId}
export const DELETE = withBusinessRoute<{ businessId: string; invoiceId: string; paymentId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:payments:delete:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, _request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { invoiceId, paymentId } = await params;
    const invoiceIdBigInt = parseId(invoiceId);
    const paymentIdBigInt = parseId(paymentId);
    if (!invoiceIdBigInt || !paymentIdBigInt) {
      return withIdNoStore(badRequest('invoiceId ou paymentId invalide.'), requestId);
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentIdBigInt, businessId: businessIdBigInt, invoiceId: invoiceIdBigInt },
    });
    if (!payment) return withIdNoStore(notFound('Paiement introuvable.'), requestId);

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
      select: { id: true, status: true, paidAt: true, totalCents: true },
    });
    if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceIdBigInt} FOR UPDATE`;
      await tx.payment.update({
        where: { id: paymentIdBigInt },
        data: { deletedAt: new Date() },
      });
      const agg = await tx.payment.aggregate({
        where: { invoiceId: invoiceIdBigInt, deletedAt: null },
        _sum: { amountCents: true },
      });
      const paidCents = agg._sum.amountCents ?? BigInt(0);
      const remaining = invoice.totalCents > paidCents ? invoice.totalCents - paidCents : BigInt(0);
      if (invoice.status === InvoiceStatus.PAID && remaining > BigInt(0)) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.SENT, paidAt: null },
        });
      }
    });

    return jsonbNoContent(requestId);
  }
);
