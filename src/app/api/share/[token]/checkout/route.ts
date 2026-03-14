import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { rateLimit, makeIpKey } from '@/server/security/rateLimit';
import { requireShareAccess } from '@/server/share/shareSession';
import { InvoiceStatus } from '@/generated/prisma';
import { decrypt } from '@/server/crypto/encryption';
import { getStripeClient } from '@/server/stripe/client';

/**
 * POST /api/share/[token]/checkout
 * Creates a Stripe Checkout session for an invoice.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(request, {
    key: makeIpKey(request, 'share:checkout'),
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

  const invoiceIdRaw = (body as { invoiceId?: string }).invoiceId;
  if (!invoiceIdRaw || typeof invoiceIdRaw !== 'string' || !/^\d+$/.test(invoiceIdRaw)) {
    return NextResponse.json({ error: 'invoiceId requis.' }, { status: 400 });
  }
  const invoiceId = BigInt(invoiceIdRaw);

  // Verify invoice belongs to this project and is payable
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
    return NextResponse.json({ error: 'Facture introuvable ou d\u00e9j\u00e0 pay\u00e9e.' }, { status: 400 });
  }

  // Load business settings and verify Stripe is configured
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: shareToken.businessId },
    select: {
      integrationStripeEnabled: true,
      integrationStripeSecretKeyCipher: true,
      integrationStripeSecretKeyIv: true,
      integrationStripeSecretKeyTag: true,
    },
  });

  if (
    !settings?.integrationStripeEnabled ||
    !settings.integrationStripeSecretKeyCipher ||
    !settings.integrationStripeSecretKeyIv ||
    !settings.integrationStripeSecretKeyTag
  ) {
    return NextResponse.json({ error: 'Paiement en ligne non configur\u00e9.' }, { status: 400 });
  }

  const stripeSecretKey = decrypt(
    settings.integrationStripeSecretKeyCipher,
    settings.integrationStripeSecretKeyIv,
    settings.integrationStripeSecretKeyTag,
  );

  const stripe = getStripeClient(stripeSecretKey);

  // Create PaymentLink record
  const linkToken = crypto.randomBytes(32).toString('base64url');
  const paymentLink = await prisma.paymentLink.create({
    data: {
      businessId: shareToken.businessId,
      invoiceId: invoice.id,
      token: linkToken,
      amountCents: Number(invoice.totalCents),
      currency: invoice.currency ?? 'EUR',
      description: `Facture ${invoice.number ?? invoice.id.toString()}`,
      status: 'ACTIVE',
    },
  });

  // Build Stripe Checkout session
  const baseUrl = request.headers.get('origin') || request.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: (invoice.currency ?? 'EUR').toLowerCase(),
          unit_amount: Number(invoice.totalCents),
          product_data: {
            name: `Facture ${invoice.number ?? invoice.id.toString()}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/share/${rawToken}?payment=success`,
    cancel_url: `${baseUrl}/share/${rawToken}?payment=cancelled`,
    metadata: {
      paymentLinkId: paymentLink.id.toString(),
      invoiceId: invoice.id.toString(),
      projectId: shareToken.projectId.toString(),
      businessId: shareToken.businessId.toString(),
    },
  });

  // Save Stripe session ID
  await prisma.paymentLink.update({
    where: { id: paymentLink.id },
    data: { stripeSessionId: session.id },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
