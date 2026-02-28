import { prisma } from '@/server/db/client';
import { withBusinessRoute } from '@/server/http/routeHandler';
import { jsonb } from '@/server/http/json';
import { badRequest, notFound, withIdNoStore } from '@/server/http/apiUtils';
import { InvoiceStatus, PaymentMethod } from '@/generated/prisma';
import { upsertCashSaleLedgerForInvoicePaid } from '@/server/services/ledger';
import { upsertFinanceForInvoicePaid } from '@/server/billing/invoiceFinance';
import { parseCentsInput, parseEuroToCents } from '@/lib/money';

// Null-returning ID parser pour les query params (comportement "soft" intentionnel)
function parseId(param: string | undefined | null): bigint | null {
  if (!param || !/^\d+$/.test(param)) return null;
  try { return BigInt(param); } catch { return null; }
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  if (typeof value !== 'string') return PaymentMethod.WIRE;
  const upper = value.toUpperCase();
  return (Object.values(PaymentMethod) as string[]).includes(upper)
    ? (upper as PaymentMethod)
    : PaymentMethod.WIRE;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

// GET /api/pro/businesses/{businessId}/payments?clientId=...
export const GET = withBusinessRoute({ minRole: 'VIEWER' }, async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt } = ctx;

  const clientIdParam = request.nextUrl.searchParams.get('clientId');
  const clientId = parseId(clientIdParam ?? undefined);

  const payments = await prisma.payment.findMany({
    where: { businessId: businessIdBigInt, deletedAt: null, ...(clientId ? { clientId } : {}) },
    orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      invoice: { select: { number: true, currency: true, clientId: true } },
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });

  return jsonb({
    items: payments.map((payment) => ({
      id: payment.id.toString(),
      invoiceId: payment.invoiceId.toString(),
      clientId: payment.clientId ? payment.clientId.toString() : payment.invoice.clientId?.toString() ?? null,
      amountCents: payment.amountCents.toString(),
      currency: payment.invoice.currency,
      paidAt: payment.paidAt.toISOString(),
      method: payment.method,
      reference: payment.reference ?? payment.invoice.number ?? `INV-${payment.invoiceId}`,
      createdBy: payment.createdBy
        ? {
            id: payment.createdBy.id.toString(),
            name: payment.createdBy.name ?? null,
            email: payment.createdBy.email ?? null,
          }
        : null,
    })),
  }, requestId);
});

// POST /api/pro/businesses/{businessId}/payments
export const POST = withBusinessRoute(
  { minRole: 'ADMIN', rateLimit: { key: (ctx) => `pro:payments:create:${ctx.businessId}:${ctx.userId}`, limit: 120, windowMs: 60 * 60 * 1000 } },
  async (ctx, request) => {
  const { requestId, businessId: businessIdBigInt, userId } = ctx;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const invoiceId = parseId((body as { invoiceId?: string }).invoiceId);
  const clientId = parseId((body as { clientId?: string }).clientId);
  const amountRaw = (body as { amount?: unknown }).amount;
  const amountCentsRaw = (body as { amountCents?: unknown }).amountCents;
  let amountCents: bigint | null = null;
  if (amountCentsRaw !== undefined) {
    const parsed = parseCentsInput(amountCentsRaw);
    if (parsed == null) {
      return withIdNoStore(badRequest('Montant invalide.'), requestId);
    }
    amountCents = BigInt(parsed);
  } else if (amountRaw !== undefined) {
    if (typeof amountRaw !== 'number' && typeof amountRaw !== 'string') {
      return withIdNoStore(badRequest('Montant invalide.'), requestId);
    }
    const parsed = parseEuroToCents(amountRaw);
    if (!Number.isFinite(parsed)) {
      return withIdNoStore(badRequest('Montant invalide.'), requestId);
    }
    amountCents = BigInt(parsed);
  }
  const dateStr = typeof (body as { date?: string }).date === 'string' ? (body as { date?: string }).date : null;
  const paidAtRaw = (body as { paidAt?: string }).paidAt;
  const paymentDate = parseDate(paidAtRaw ?? dateStr) ?? new Date();
  const method = parsePaymentMethod((body as { method?: unknown }).method);
  const reference = typeof (body as { reference?: unknown }).reference === 'string' ? (body as { reference: string }).reference.trim() : null;
  const note = typeof (body as { note?: unknown }).note === 'string' ? (body as { note: string }).note.trim() : null;

  if (!invoiceId) return withIdNoStore(badRequest('invoiceId requis.'), requestId);
  if (Number.isNaN(paymentDate.getTime())) return withIdNoStore(badRequest('Date de paiement invalide.'), requestId);
  if (amountCents === null || amountCents <= BigInt(0)) return withIdNoStore(badRequest('Montant invalide.'), requestId);

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId: businessIdBigInt },
  });
  if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);
  if (invoice.status === InvoiceStatus.CANCELLED) {
    return withIdNoStore(badRequest('Impossible d’ajouter un paiement sur une facture annulée.'), requestId);
  }
  if (clientId && invoice.clientId !== clientId) {
    return withIdNoStore(badRequest('invoiceId ne correspond pas au client.'), requestId);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Invoice" WHERE id = ${invoiceId} FOR UPDATE`;
      const paymentAgg = await tx.payment.aggregate({
        where: { invoiceId: invoiceId, deletedAt: null },
        _sum: { amountCents: true },
      });
      const alreadyPaid = paymentAgg._sum.amountCents ?? BigInt(0);
      const remaining = invoice.totalCents > alreadyPaid ? invoice.totalCents - alreadyPaid : BigInt(0);
      if (amountCents! > remaining) {
        throw new Error('OVERPAY');
      }

      await tx.payment.create({
        data: {
          businessId: businessIdBigInt,
          invoiceId,
          projectId: invoice.projectId,
          clientId: invoice.clientId ?? undefined,
          createdByUserId: userId,
          amountCents: amountCents!,
          paidAt: paymentDate,
          method,
          reference: reference || null,
          note: note || null,
        },
      });

      const newPaid = alreadyPaid + amountCents!;
      if (newPaid >= invoice.totalCents) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.PAID, paidAt: paymentDate },
        });
        await upsertCashSaleLedgerForInvoicePaid(tx, {
          invoice: {
            id: invoice.id,
            businessId: invoice.businessId,
            totalCents: invoice.totalCents,
            paidAt: paymentDate,
            number: invoice.number,
          },
          createdByUserId: userId,
        });
        await upsertFinanceForInvoicePaid(tx, {
          invoice: {
            id: invoice.id,
            businessId: invoice.businessId,
            projectId: invoice.projectId,
            quoteId: invoice.quoteId ?? null,
            totalCents: invoice.totalCents,
          },
          paidAt: paymentDate,
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'OVERPAY') {
      return withIdNoStore(badRequest('Montant supérieur au reste à payer.'), requestId);
    }
    throw err;
  }

  return jsonb({ ok: true }, requestId, { status: 201 });
  }
);
