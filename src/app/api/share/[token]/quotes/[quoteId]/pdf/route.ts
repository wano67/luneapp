import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireShareAccess } from '@/server/share/shareSession';
import { fetchAndBuildQuotePdf } from '@/server/share/pdfHelpers';
import { QuoteStatus } from '@/generated/prisma';

/**
 * GET /api/share/[token]/quotes/[quoteId]/pdf
 * Public quote PDF download by share token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; quoteId: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:quote:pdf'),
    limit: 30,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token: rawToken, quoteId: rawQuoteId } = await params;

  const access = await requireShareAccess(request, rawToken);
  if (!access.ok) return access.response;

  const shareToken = access.token;

  let quoteId: bigint;
  try {
    quoteId = BigInt(rawQuoteId);
  } catch {
    return NextResponse.json({ error: 'quoteId invalide.' }, { status: 400 });
  }

  // Verify the quote belongs to this project and has a downloadable status
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      projectId: shareToken.projectId,
      businessId: shareToken.businessId,
      status: { in: [QuoteStatus.SENT, QuoteStatus.SIGNED] },
    },
    select: { id: true, number: true },
  });

  if (!quote) {
    return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });
  }

  const pdf = await fetchAndBuildQuotePdf(quoteId, shareToken.projectId, shareToken.businessId);
  if (!pdf) {
    return NextResponse.json({ error: 'Erreur lors de la génération du PDF.' }, { status: 500 });
  }

  const filename = `devis-${quote.number ?? quote.id.toString()}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': String(pdf.length),
    },
  });
}
