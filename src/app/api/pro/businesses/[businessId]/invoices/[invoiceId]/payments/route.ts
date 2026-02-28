import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb, jsonbCreated } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { InvoiceStatus, PaymentMethod } from '@/generated/prisma';
import { ensureLegacyPaymentForPaidInvoice } from '@/server/billing/payments';
import { upsertCashSaleLedgerForInvoicePaid } from '@/server/services/ledger';
import { upsertFinanceForInvoicePaid } from '@/server/billing/invoiceFinance';
import { parseCentsInput } from '@/lib/money';
import { parseIdOpt, parseDateOpt } from '@/server/http/parsers';

function parsePaymentMethod(value: unknown): PaymentMethod {
  if (typeof value !== 'string') return PaymentMethod.WIRE;
  const upper = value.toUpperCase();
  return (Object.values(PaymentMethod) as string[]).includes(upper)
    ? (upper as PaymentMethod)
    : PaymentMethod.WIRE;
}

// GET /api/pro/businesses/{businessId}/invoices/{invoiceId}/payments
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
    });
    if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);

    await ensureLegacyPaymentForPaidInvoice(prisma, invoice);

    const payments = await prisma.payment.findMany({
      where: { invoiceId: invoiceIdBigInt, businessId: businessIdBigInt, deletedAt: null },
      orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
      include: { createdBy: { select: { id: true, name: true, email: true } } },
    });

    return jsonb(
      {
        items: payments.map((p) => ({
          id: p.id.toString(),
          invoiceId: p.invoiceId.toString(),
          businessId: p.businessId.toString(),
          projectId: p.projectId ? p.projectId.toString() : null,
          clientId: p.clientId ? p.clientId.toString() : null,
          amountCents: p.amountCents.toString(),
          paidAt: p.paidAt.toISOString(),
          method: p.method,
          reference: p.reference ?? null,
          note: p.note ?? null,
          createdBy: p.createdBy
            ? { id: p.createdBy.id.toString(), name: p.createdBy.name ?? null, email: p.createdBy.email ?? null }
            : null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
      },
      requestId
    );
  }
);

// POST /api/pro/businesses/{businessId}/invoices/{invoiceId}/payments
export const POST = withBusinessRoute<{ businessId: string; invoiceId: string }>(
  {
    minRole: 'ADMIN',
    rateLimit: {
      key: (ctx) => `pro:payments:create:${ctx.businessId}:${ctx.userId}`,
      limit: 120,
      windowMs: 60 * 60 * 1000,
    },
  },
  async (ctx, request, params) => {
    const { requestId, businessId: businessIdBigInt } = ctx;
    const { invoiceId } = await params;
    const invoiceIdBigInt = parseIdOpt(invoiceId);
    if (!invoiceIdBigInt) {
      return withIdNoStore(badRequest('invoiceId invalide.'), requestId);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return withIdNoStore(badRequest('Payload invalide.'), requestId);

    const amountRaw = (body as { amountCents?: unknown }).amountCents;
    const parsedAmount = parseCentsInput(amountRaw);
    if (parsedAmount == null) {
      return withIdNoStore(badRequest('Montant invalide.'), requestId);
    }
    const amountCents = BigInt(parsedAmount);
    if (amountCents <= BigInt(0)) return withIdNoStore(badRequest('Montant invalide.'), requestId);

    const paidAt = parseDateOpt((body as { paidAt?: unknown }).paidAt) ?? new Date();
    if (Number.isNaN(paidAt.getTime())) return withIdNoStore(badRequest('Date invalide.'), requestId);

    const method = parsePaymentMethod((body as { method?: unknown }).method);
    const reference =
      typeof (body as { reference?: unknown }).reference === 'string'
        ? (body as { reference: string }).reference.trim()
        : null;
    const note =
      typeof (body as { note?: unknown }).note === 'string' ? (body as { note: string }).note.trim() : null;

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
    });
    if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      return withIdNoStore(badRequest('Impossible d\u2019ajouter un paiement sur une facture annulée.'), requestId);
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceIdBigInt} FOR UPDATE`;
        const paymentAgg = await tx.payment.aggregate({
          where: { invoiceId: invoiceIdBigInt, deletedAt: null },
          _sum: { amountCents: true },
        });
        const alreadyPaid = paymentAgg._sum.amountCents ?? BigInt(0);
        const remaining = invoice.totalCents > alreadyPaid ? invoice.totalCents - alreadyPaid : BigInt(0);
        if (amountCents > remaining) {
          throw new Error('OVERPAY');
        }

        await tx.payment.create({
          data: {
            businessId: businessIdBigInt,
            invoiceId: invoiceIdBigInt,
            projectId: invoice.projectId,
            clientId: invoice.clientId ?? undefined,
            createdByUserId: ctx.userId,
            amountCents,
            paidAt,
            method,
            reference: reference || null,
            note: note || null,
          },
        });

        const newPaid = alreadyPaid + amountCents;
        if (newPaid >= invoice.totalCents) {
          await tx.invoice.update({
            where: { id: invoiceIdBigInt },
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
          await upsertFinanceForInvoicePaid(tx, {
            invoice: {
              id: invoice.id,
              businessId: invoice.businessId,
              projectId: invoice.projectId,
              quoteId: invoice.quoteId ?? null,
              totalCents: invoice.totalCents,
            },
            paidAt,
          });
        }
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'OVERPAY') {
        return withIdNoStore(badRequest('Montant supérieur au reste à payer.'), requestId);
      }
      throw err;
    }

    return jsonbCreated({ ok: true }, requestId);
  }
);
