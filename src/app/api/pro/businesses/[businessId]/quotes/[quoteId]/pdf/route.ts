import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requireAuthPro } from '@/server/auth/requireAuthPro';
import { requireBusinessRole } from '@/server/auth/businessRole';
import { withNoStore } from '@/server/security/csrf';
import { getRequestId, badRequest, unauthorized, forbidden, notFound, withRequestId } from '@/server/http/apiUtils';
import { buildQuotePdf } from '@/server/pdf/quotePdf';

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

// GET /api/pro/businesses/{businessId}/quotes/{quoteId}/pdf
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; quoteId: string }> }
) {
  const requestId = getRequestId(request);
  const { businessId, quoteId } = await context.params;

  let userId: string;
  try {
    ({ userId } = await requireAuthPro(request));
  } catch {
    return withIdNoStore(unauthorized(), requestId);
  }

  const businessIdBigInt = parseId(businessId);
  const quoteIdBigInt = parseId(quoteId);
  if (!businessIdBigInt || !quoteIdBigInt) {
    return withIdNoStore(badRequest('businessId ou quoteId invalide.'), requestId);
  }

  const membership = await requireBusinessRole(businessIdBigInt, BigInt(userId), 'VIEWER');
  if (!membership) return withIdNoStore(forbidden(), requestId);

  const quote = await prisma.quote.findFirst({
    where: { id: quoteIdBigInt, businessId: businessIdBigInt },
    include: {
      items: true,
      project: { select: { name: true } },
      client: { select: { name: true, email: true } },
      business: { select: { name: true } },
    },
  });
  if (!quote) return withIdNoStore(notFound('Devis introuvable.'), requestId);

  const pdf = await buildQuotePdf({
    quoteId: quote.id.toString(),
    number: quote.number,
    businessName: quote.business.name,
    projectName: quote.project.name,
    clientName: quote.client?.name ?? null,
    clientEmail: quote.client?.email ?? null,
    issuedAt: quote.issuedAt ? quote.issuedAt.toISOString() : quote.createdAt.toISOString(),
    expiresAt: quote.expiresAt ? quote.expiresAt.toISOString() : null,
    totalCents: quote.totalCents.toString(),
    depositCents: quote.depositCents.toString(),
    balanceCents: quote.balanceCents.toString(),
    currency: quote.currency,
    requestId,
    items: quote.items.map((item) => ({
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
      'Content-Disposition': `attachment; filename="quote-${quote.number ?? quote.id}.pdf"`,
    },
  });

  return withIdNoStore(res, requestId);
}
