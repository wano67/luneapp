import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { assertSameOrigin, withNoStore } from '@/server/security/csrf';
import { rateLimit } from '@/server/security/rateLimit';
import {
  badRequest,
  forbidden,
  getRequestId,
  notFound,
  unauthorized,
  withRequestId,
} from '@/server/http/apiUtils';
import { InvoiceStatus } from '@/generated/prisma';

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

// DELETE /api/pro/businesses/{businessId}/invoices/{invoiceId}/payments/{paymentId}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; invoiceId: string; paymentId: string }> }
) {
  const requestId = getRequestId(request);
  const csrf = assertSameOrigin(request);
  if (csrf) return withIdNoStore(csrf, requestId);

  const { businessId, invoiceId, paymentId } = await context.params;
  const businessIdBigInt = parseId(businessId);
  const invoiceIdBigInt = parseId(invoiceId);
  const paymentIdBigInt = parseId(paymentId);
  if (!businessIdBigInt || !invoiceIdBigInt || !paymentIdBigInt) {
    return withIdNoStore(badRequest('businessId, invoiceId ou paymentId invalide.'), requestId);
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
    key: `pro:payments:delete:${businessIdBigInt}:${userId}`,
    limit: 60,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return withIdNoStore(limited, requestId);

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

  return withIdNoStore(new NextResponse(null, { status: 204 }), requestId);
}
