import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { QuoteStatus, ProjectQuoteStatus } from '@/generated/prisma';
import { evaluateProjectLifecycle } from '@/server/billing/projectLifecycle';
import { notifyQuoteSigned, notifyProjectActivated } from '@/server/services/notifications';
import crypto from 'crypto';

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('base64url');
}

/**
 * POST /api/share/[token]/actions — Client actions on the share page.
 *
 * Actions:
 *   - { action: 'sign_quote', quoteId: string }  — Sign a SENT quote
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
  if (!rawToken?.trim()) {
    return NextResponse.json({ error: 'Token requis.' }, { status: 400 });
  }

  const tokenHash = hashToken(rawToken.trim());

  const shareToken = await prisma.projectShareToken.findUnique({
    where: { token: tokenHash },
    select: { projectId: true, businessId: true, revokedAt: true, expiresAt: true },
  });

  if (!shareToken) {
    return NextResponse.json({ error: 'Lien invalide.' }, { status: 403 });
  }
  if (shareToken.revokedAt) {
    return NextResponse.json({ error: 'Ce lien a été révoqué.' }, { status: 403 });
  }
  if (shareToken.expiresAt && shareToken.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Ce lien a expiré.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 });
  }

  const action = (body as { action?: string }).action;

  if (action === 'sign_quote') {
    return handleSignQuote(body, shareToken);
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
}

async function handleSignQuote(
  body: Record<string, unknown>,
  shareToken: { projectId: bigint; businessId: bigint },
) {
  const quoteIdRaw = (body as { quoteId?: string }).quoteId;
  if (!quoteIdRaw || typeof quoteIdRaw !== 'string' || !/^\d+$/.test(quoteIdRaw)) {
    return NextResponse.json({ error: 'quoteId requis.' }, { status: 400 });
  }
  const quoteId = BigInt(quoteIdRaw);

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
      return { error: 'Devis introuvable ou déjà signé.' } as const;
    }

    await tx.quote.update({
      where: { id: quoteId },
      data: { status: QuoteStatus.SIGNED, signedAt: new Date() },
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
    message: 'Devis signé avec succès.',
    projectActivated: result.lifecycle.projectBecameActive,
  });
}
