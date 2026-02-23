import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { InvoiceStatus, PaymentMethod } from '@/generated/prisma';
import { ensureLegacyPaymentForPaidInvoice } from '@/server/billing/payments';
import { upsertCashSaleLedgerForInvoicePaid } from '@/server/services/ledger';

function parseId(param: string | undefined) {
  if (!param || !/^\d+$/.test(param)) return null;
  try {
    return BigInt(param);
  } catch {
    return null;
  }
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  if (typeof value !== 'string') return PaymentMethod.WIRE;
  const upper = value.toUpperCase();
  return (Object.values(PaymentMethod) as string[]).includes(upper)
    ? (upper as PaymentMethod)
    : PaymentMethod.WIRE;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
}

// GET /api/pro/businesses/{businessId}/invoices/{invoiceId}/payments
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; invoiceId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, invoiceId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const invoiceIdBigInt = parseId(invoiceId);
  if (!businessIdBigInt || !invoiceIdBigInt) {
    return withIdNoStore(badRequest('businessId ou invoiceId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

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

  return withIdNoStore(
    jsonNoStore({
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
    }),
    requestId
  );
}

// POST /api/pro/businesses/{businessId}/invoices/{invoiceId}/payments
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; invoiceId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, invoiceId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const invoiceIdBigInt = parseId(invoiceId);
  if (!businessIdBigInt || !invoiceIdBigInt) {
    return withIdNoStore(badRequest('businessId ou invoiceId invalide.'), requestId);
  }

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'ADMIN');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const limited = rateLimit(request, {
    key: `pro:payments:create:${businessIdBigInt}:${userId}`,
    limit: 120,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return withIdNoStore(badRequest('Payload invalide.'), requestId);

  const amountRaw = (body as { amountCents?: unknown }).amountCents;
  if (typeof amountRaw !== 'number' || !Number.isFinite(amountRaw)) {
    return withIdNoStore(badRequest('Montant invalide.'), requestId);
  }
  const amountCents = BigInt(Math.trunc(amountRaw));
  if (amountCents <= BigInt(0)) return withIdNoStore(badRequest('Montant invalide.'), requestId);

  const paidAt = parseIsoDate((body as { paidAt?: unknown }).paidAt) ?? new Date();
  if (Number.isNaN(paidAt.getTime())) return withIdNoStore(badRequest('Date invalide.'), requestId);

  const method = parsePaymentMethod((body as { method?: unknown }).method);
  const reference = typeof (body as { reference?: unknown }).reference === 'string'
    ? (body as { reference: string }).reference.trim()
    : null;
  const note = typeof (body as { note?: unknown }).note === 'string'
    ? (body as { note: string }).note.trim()
    : null;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceIdBigInt, businessId: businessIdBigInt },
  });
  if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);
  if (invoice.status === InvoiceStatus.CANCELLED) {
    return withIdNoStore(badRequest('Impossible d’ajouter un paiement sur une facture annulée.'), requestId);
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
          createdByUserId: BigInt(userId),
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
          createdByUserId: BigInt(userId),
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'OVERPAY') {
      return withIdNoStore(badRequest('Montant supérieur au reste à payer.'), requestId);
    }
    throw err;
  }

  return withIdNoStore(NextResponse.json({ ok: true }, { status: 201 }), requestId);
}
