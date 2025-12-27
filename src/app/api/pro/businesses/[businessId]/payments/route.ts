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
import { InvoiceStatus } from '@/generated/prisma/client';
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
  const where = {
    businessId: businessIdBigInt,
    status: InvoiceStatus.PAID,
    ...(clientId ? { clientId } : {}),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ paidAt: 'desc' }, { updatedAt: 'desc' }],
    take: 50,
  });

  return withIdNoStore(
    jsonNoStore({
      items: invoices.map((inv) => ({
        id: inv.id.toString(),
        invoiceId: inv.id.toString(),
        clientId: inv.clientId ? inv.clientId.toString() : null,
        amountCents: Number(inv.totalCents),
        currency: inv.currency,
        paidAt: inv.paidAt ? inv.paidAt.toISOString() : inv.updatedAt.toISOString(),
        reference: inv.number ?? `INV-${inv.id}`,
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
  let amount: number | null = null;
  if (amountRaw !== undefined) {
    if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) {
      amount = amountRaw;
    } else {
      return withIdNoStore(badRequest('Montant invalide.'), requestId);
    }
  }
  const dateStr = typeof (body as { date?: string }).date === 'string' ? (body as { date?: string }).date : null;
  const paymentDate = dateStr ? new Date(dateStr) : new Date();

  if (!invoiceId) return withIdNoStore(badRequest('invoiceId requis.'), requestId);
  if (Number.isNaN(paymentDate.getTime())) return withIdNoStore(badRequest('Date de paiement invalide.'), requestId);
  if (amount !== null && amount <= 0) return withIdNoStore(badRequest('Montant invalide.'), requestId);

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId: businessIdBigInt },
  });
  if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);
  if (clientId && invoice.clientId !== clientId) {
    return withIdNoStore(badRequest('invoiceId ne correspond pas au client.'), requestId);
  }

  // Optionally enforce amount match to total
  if (amount !== null) {
    const total = Number(invoice.totalCents) / 100;
    if (Math.abs(total - amount) > 0.01) {
      return withIdNoStore(badRequest('Montant différent du total de facture.'), requestId);
    }
  }

  await prisma.$transaction(async (tx) => {
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
  });

  return withIdNoStore(
    NextResponse.json({ ok: true }, { status: 201 }),
    requestId,
  );
}
