import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { withNoStore } from '@/server/security/csrf';
import { getRequestId, badRequest, unauthorized, forbidden, notFound, withRequestId } from '@/server/http/apiUtils';
import { buildInvoicePdf } from '@/server/pdf/invoicePdf';

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

// GET /api/pro/businesses/{businessId}/invoices/{invoiceId}/pdf
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
    include: {
      items: true,
      project: { select: { name: true } },
      client: { select: { name: true, email: true } },
      business: { select: { name: true } },
    },
  });
  if (!invoice) return withIdNoStore(notFound('Facture introuvable.'), requestId);

  const pdf = await buildInvoicePdf({
    invoiceId: invoice.id.toString(),
    number: invoice.number,
    businessName: invoice.business.name,
    projectName: invoice.project.name,
    clientName: invoice.client?.name ?? null,
    clientEmail: invoice.client?.email ?? null,
    issuedAt: invoice.issuedAt ? invoice.issuedAt.toISOString() : invoice.createdAt.toISOString(),
    dueAt: invoice.dueAt ? invoice.dueAt.toISOString() : null,
    paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
    totalCents: invoice.totalCents.toString(),
    depositCents: invoice.depositCents.toString(),
    balanceCents: invoice.balanceCents.toString(),
    currency: invoice.currency,
    requestId,
    items: invoice.items.map((item) => ({
      label: item.label,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents.toString(),
      totalCents: item.totalCents.toString(),
    })),
  });

  const res = new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.number ?? invoice.id}.pdf"`,
    },
  });

  return withIdNoStore(res, requestId);
}
