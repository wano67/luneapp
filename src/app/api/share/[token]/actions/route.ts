import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { QuoteStatus, ProjectQuoteStatus, InvoiceStatus } from '@/generated/prisma';
import { evaluateProjectLifecycle } from '@/server/billing/projectLifecycle';
import { notifyQuoteSigned, notifyProjectActivated, notifyTransferNotified } from '@/server/services/notifications';
import { formatCents } from '@/lib/money';
import { requireShareAccess } from '@/server/share/shareSession';

/**
 * POST /api/share/[token]/actions — Client actions on the share page.
 *
 * Actions:
 *   - { action: 'sign_quote', quoteId: string, consent: true }  — Sign a SENT quote (with consent + IP/UA)
 *   - { action: 'notify_transfer', invoiceId: string }  — Notify that a bank transfer was made
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Aggressive rate limit: 10 per hour
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:action'),
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (limited) return limited;

  const { token: rawToken } = await params;

  const access = await requireShareAccess(request, rawToken);
  if (!access.ok) return access.response;

  const shareToken = access.token;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 });
  }

  const action = (body as { action?: string }).action;

  if (action === 'sign_quote') {
    return handleSignQuote(request, body, shareToken);
  }

  if (action === 'notify_transfer') {
    return handleNotifyTransfer(body, shareToken);
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}

async function handleSignQuote(
  request: NextRequest,
  body: Record<string, unknown>,
  shareToken: { projectId: bigint; businessId: bigint },
) {
  const quoteIdRaw = (body as { quoteId?: string }).quoteId;
  if (!quoteIdRaw || typeof quoteIdRaw !== 'string' || !/^\d+$/.test(quoteIdRaw)) {
    return NextResponse.json({ error: 'quoteId requis.' }, { status: 400 });
  }

  if (!(body as { consent?: boolean }).consent) {
    return NextResponse.json({ error: 'Le consentement est requis pour signer.' }, { status: 400 });
  }

  const quoteId = BigInt(quoteIdRaw);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const consentText = 'J\u2019accepte les termes de ce devis et confirme ma signature \u00e9lectronique.';

  const result = await prisma.$transaction(async (tx) => {
    // Lock the quote row
    await tx.$executeRaw`SELECT id FROM "Quote" WHERE id = ${quoteId} FOR UPDATE`;

    const quote = await tx.quote.findFirst({
      where: {
        id: quoteId,
        projectId: shareToken.projectId,
        businessId: shareToken.businessId,
        status: QuoteStatus.SENT,
      },
      select: { id: true, number: true },
    });

    if (!quote) {
      return { error: 'Devis introuvable ou d\u00e9j\u00e0 sign\u00e9.' } as const;
    }

    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.SIGNED,
        signedAt: new Date(),
        signatureIp: ip,
        signatureUserAgent: userAgent,
        signatureConsent: consentText,
      },
    });

    await tx.project.update({
      where: { id: shareToken.projectId },
      data: {
        quoteStatus: ProjectQuoteStatus.SIGNED,
        billingQuoteId: quoteId,
      },
    });

    const lifecycle = await evaluateProjectLifecycle(
      tx, shareToken.projectId, shareToken.businessId,
    );

    return { ok: true, lifecycle, quoteNumber: quote.number } as const;
  });

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Fire-and-forget notifications (SYSTEM_USER = 0n since client is acting)
  const SYSTEM_USER = 0n;
  void notifyQuoteSigned(SYSTEM_USER, shareToken.businessId, shareToken.projectId, result.quoteNumber);
  if (result.lifecycle.projectBecameActive) {
    void notifyProjectActivated(SYSTEM_USER, shareToken.businessId, shareToken.projectId);
  }

  return NextResponse.json({
    ok: true,
    message: 'Devis sign\u00e9 avec succ\u00e8s.',
    projectActivated: result.lifecycle.projectBecameActive,
  });
}

async function handleNotifyTransfer(
  body: Record<string, unknown>,
  shareToken: { projectId: bigint; businessId: bigint },
) {
  const invoiceIdRaw = (body as { invoiceId?: string }).invoiceId;
  if (!invoiceIdRaw || typeof invoiceIdRaw !== 'string' || !/^\d+$/.test(invoiceIdRaw)) {
    return NextResponse.json({ error: 'invoiceId requis.' }, { status: 400 });
  }
  const invoiceId = BigInt(invoiceIdRaw);

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      projectId: shareToken.projectId,
      businessId: shareToken.businessId,
      status: InvoiceStatus.SENT,
    },
    select: { id: true, number: true, totalCents: true, currency: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Facture introuvable.' }, { status: 400 });
  }

  const amountLabel = formatCents(Number(invoice.totalCents), invoice.currency ?? 'EUR');

  void notifyTransferNotified(
    shareToken.businessId,
    shareToken.projectId,
    invoice.number,
    amountLabel,
  );

  return NextResponse.json({ ok: true, message: 'Notification envoy\u00e9e.' });
}
