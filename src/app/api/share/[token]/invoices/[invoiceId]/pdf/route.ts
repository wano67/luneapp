import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireShareAccess } from '@/server/share/shareSession';
import { fetchAndBuildInvoicePdf } from '@/server/share/pdfHelpers';
import { InvoiceStatus } from '@/generated/prisma';

/**
 * GET /api/share/[token]/invoices/[invoiceId]/pdf
 * Public invoice PDF download by share token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; invoiceId: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:invoice:pdf'),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token: rawToken, invoiceId: rawInvoiceId } = await params;

  const access = await requireShareAccess(request, rawToken);
  if (!access.ok) return access.response;

  const shareToken = access.token;

  let invoiceId: bigint;
  try {
    invoiceId = BigInt(rawInvoiceId);
  } catch {
    return NextResponse.json({ error: 'invoiceId invalide.' }, { status: 400 });
  }

  // Verify the invoice belongs to this project and has a downloadable status
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      projectId: shareToken.projectId,
      businessId: shareToken.businessId,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.PAID] },
    },
    select: { id: true, number: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Facture introuvable.' }, { status: 404 });
  }

  const pdf = await fetchAndBuildInvoicePdf(invoiceId, shareToken.projectId, shareToken.businessId);
  if (!pdf) {
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF.' }, { status: 500 });
  }

  const filename = `facture-${invoice.number ?? invoice.id.toString()}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(pdf.length),
    },
  });
}
