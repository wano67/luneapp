import Stripe from 'stripe';

export function getStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
}
