import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { InvoiceStatus, PaymentMethod } from '@/generated/prisma';
import { upsertCashSaleLedgerForInvoicePaid } from '@/server/services/ledger';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// POST /api/pro/businesses/{businessId}/invoices/{invoiceId}/mark-paid
export const POST = withBusinessRoute<{ businessId: string; invoiceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:payments:mark-paid:${ctx.businessId}:${ctx.userId}`,
      limit: 60,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { invoiceId } = await params;
    const invoiceIdBigInt = parseId(invoiceId);
    if (!invoiceIdBigInt) {
      return withIdNoStore(badRequest('invoiceId invalide.'), requestId);
    }

    const body = await request.json().catch(() => null);
    const paidAt = parseIsoDate((body as { paidAt?: unknown })?.paidAt) ?? new Date();
    if (Number.isNaN(paidAt.getTime())) return withIdNoStore(badRequest('Date invalide.'), requestId);
    const methodRaw = (body as { method?: unknown })?.method;
    const method =
      typeof methodRaw === 'string' && (Object.values(PaymentMethod) as string[]).includes(methodRaw.toUpperCase())
        ? (methodRaw.toUpperCase() as PaymentMethod)
        : PaymentMethod.WIRE;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
    });
    if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      return withIdNoStore(badRequest('Facture annulée.'), requestId);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceIdBigInt} FOR UPDATE`;
        const remaining = await tx.payment.aggregate({
          where: { invoiceId: invoiceIdBigInt, deletedAt: null },
          _sum: { amountCents: true },
        });
        const alreadyPaid = remaining._sum.amountCents ?? BigInt(0);
        const amountCents = invoice.totalCents > alreadyPaid ? invoice.totalCents - alreadyPaid : BigInt(0);
        if (amountCents <= BigInt(0)) {
          throw new Error('ALREADY_PAID');
        }

        await tx.payment.create({
          data: {
            businessId: invoice.businessId,
            invoiceId: invoice.id,
            projectId: invoice.projectId,
            clientId: invoice.clientId ?? undefined,
            createdByUserId: ctx.userId,
            amountCents,
            paidAt,
            method,
            note: 'Marquée comme payée',
          },
        });
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.PAID, paidAt },
        });
        await upsertCashSaleLedgerForInvoicePaid(tx, {
          invoice: {
            id: invoice.id,
            businessId: invoice.businessId,
            totalCents: invoice.totalCents,
            paidAt,
            number: invoice.number,
          },
          createdByUserId: ctx.userId,
        });
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'ALREADY_PAID') {
        return withIdNoStore(badRequest('Facture déjà soldée.'), requestId);
      }
      throw err;
    }

    return jsonbCreated({ ok: true }, requestId);
  }
);
