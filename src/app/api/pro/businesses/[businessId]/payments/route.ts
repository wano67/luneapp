import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { assertSameOrigin, jsonNoStore, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
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

function withIdNoStore(res: NextResponse, requestId: string) {
  return withNoStore(withRequestId(res, requestId));
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
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> },
) {
  const requestId = getRequestId(request);
  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

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

  return withIdNoStore(
    jsonNoStore({
      items: payments.map((payment) => ({
        id: payment.id.toString(),
        invoiceId: payment.invoiceId.toString(),
        clientId: payment.clientId ? payment.clientId.toString() : payment.invoice.clientId?.toString() ?? null,
        amountCents: Number(payment.amountCents),
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
    }),
    requestId,
  );
}

// POST /api/pro/businesses/{businessId}/payments
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> },
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  if (!businessIdBigInt) return withIdNoStore(badRequest('businessId invalide.'), requestId);

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

  const invoiceId = parseId((body as { invoiceId?: string }).invoiceId);
  const clientId = parseId((body as { clientId?: string }).clientId);
  const amountRaw = (body as { amount?: unknown }).amount;
  const amountCentsRaw = (body as { amountCents?: unknown }).amountCents;
  let amountCents: bigint | null = null;
  if (amountCentsRaw !== undefined) {
    if (typeof amountCentsRaw === 'number' && Number.isFinite(amountCentsRaw)) {
      amountCents = BigInt(Math.trunc(amountCentsRaw));
    } else {
      return withIdNoStore(badRequest('Montant invalide.'), requestId);
    }
  } else if (amountRaw !== undefined) {
    if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) {
      amountCents = BigInt(Math.round(amountRaw * 100));
    } else {
      return withIdNoStore(badRequest('Montant invalide.'), requestId);
    }
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
          createdByUserId: BigInt(userId),
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

  return withIdNoStore(
    NextResponse.json({ ok: true }, { status: 201 }),
    requestId,
  );
}
