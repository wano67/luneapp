import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/server/db/client';
import { decrypt } from '@/server/crypto/encryption';
import { getStripeClient } from '@/server/stripe/client';
import { notifyPaymentReceived } from '@/server/services/notifications';
import { formatCents } from '@/lib/money';

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler for checkout session events.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
  }

  // Extract businessId from metadata to get the correct Stripe secret key.
  // We parse the event body first (unverified) to get the metadata,
  // then re-verify with the correct key.
  let unverifiedEvent: Stripe.Event;
  try {
    unverifiedEvent = JSON.parse(rawBody) as Stripe.Event;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const session = (unverifiedEvent.data?.object ?? {}) as Stripe.Checkout.Session;
  const businessIdStr = session.metadata?.businessId;
  if (!businessIdStr) {
    return NextResponse.json({ error: 'Missing businessId in metadata.' }, { status: 400 });
  }

  let businessId: bigint;
  try {
    businessId = BigInt(businessIdStr);
  } catch {
    return NextResponse.json({ error: 'Invalid businessId.' }, { status: 400 });
  }

  // Load business Stripe config
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId },
    select: {
      integrationStripeSecretKeyCipher: true,
      integrationStripeSecretKeyIv: true,
      integrationStripeSecretKeyTag: true,
    },
  });

  if (!settings?.integrationStripeSecretKeyCipher || !settings.integrationStripeSecretKeyIv || !settings.integrationStripeSecretKeyTag) {
    return NextResponse.json({ error: 'Stripe not configured for this business.' }, { status: 400 });
  }

  const stripeSecretKey = decrypt(settings.integrationStripeSecretKeyCipher, settings.integrationStripeSecretKeyIv, settings.integrationStripeSecretKeyTag);
  const stripe = getStripeClient(stripeSecretKey);

  // Verify the webhook signature
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] Signature verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    await handleSessionCompleted(event.data.object as Stripe.Checkout.Session);
  } else if (event.type === 'checkout.session.expired') {
    await handleSessionExpired(event.data.object as Stripe.Checkout.Session);
  }

  return NextResponse.json({ received: true });
}

async function handleSessionCompleted(session: Stripe.Checkout.Session) {
  const paymentLinkIdStr = session.metadata?.paymentLinkId;
  const invoiceIdStr = session.metadata?.invoiceId;
  const projectIdStr = session.metadata?.projectId;
  const businessIdStr = session.metadata?.businessId;

  if (!paymentLinkIdStr || !invoiceIdStr || !businessIdStr) return;

  const paymentLinkId = BigInt(paymentLinkIdStr);
  const invoiceId = BigInt(invoiceIdStr);
  const businessId = BigInt(businessIdStr);
  const projectId = projectIdStr ? BigInt(projectIdStr) : null;

  await prisma.$transaction(async (tx) => {
    // Update PaymentLink
    await tx.paymentLink.update({
      where: { id: paymentLinkId },
      data: { status: 'PAID', paidAt: new Date() },
    });

    // Get invoice for details
    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      select: { id: true, number: true, totalCents: true, currency: true, clientId: true, projectId: true },
    });

    if (!invoice) return;

    // Create Payment record
    await tx.payment.create({
      data: {
        businessId,
        invoiceId: invoice.id,
        projectId: invoice.projectId,
        clientId: invoice.clientId,
        amountCents: invoice.totalCents,
        paidAt: new Date(),
        method: 'CARD',
        reference: session.id,
      },
    });

    // Mark invoice as paid
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  });

  // Send notification (fire-and-forget)
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { number: true, totalCents: true, currency: true },
  });

  if (invoice && projectId) {
    const amountLabel = formatCents(Number(invoice.totalCents), invoice.currency ?? 'EUR');
    void notifyPaymentReceived(0n, businessId, projectId, amountLabel, invoice.number);
  }
}

async function handleSessionExpired(session: Stripe.Checkout.Session) {
  const paymentLinkIdStr = session.metadata?.paymentLinkId;
  if (!paymentLinkIdStr) return;

  await prisma.paymentLink.update({
    where: { id: BigInt(paymentLinkIdStr) },
    data: { status: 'EXPIRED' },
  });
}
