/**
 * Smoke test: catalog default -> project service -> pricing -> quote -> invoice.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm accounting:smoke
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request, getLastRequestId } = createRequester(baseUrl);

async function login(): Promise<void> {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return;
  }
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
}

function toBigInt(value: unknown) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string') return BigInt(value);
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  throw new Error(`Invalid bigint: ${String(value)}`);
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log('Login...');
  await login();

  console.log('Fetch businesses...');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${getLastRequestId()}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');

  console.log(`Business ${businessId}`);

  console.log('Create service with default price...');
  const defaultPriceCents = 12345;
  const serviceCode = `SER-ACC-${Date.now()}`;
  const { res: createSvcRes, json: createSvcJson } = await request(
    `/api/pro/businesses/${businessId}/services`,
    {
      method: 'POST',
      body: {
        code: serviceCode,
        name: `Accounting Smoke ${Date.now()}`,
        description: 'Accounting chain smoke',
        defaultPriceCents,
      },
    }
  );
  if (!createSvcRes.ok) {
    throw new Error(`Create service failed (${createSvcRes.status}) ref=${getLastRequestId()}`);
  }
  const serviceId = (createSvcJson as { id?: string })?.id;
  if (!serviceId) throw new Error('Service creation returned no id.');
  const serviceDefault = toBigInt(
    (createSvcJson as { defaultPriceCents?: string | null })?.defaultPriceCents ?? defaultPriceCents
  );

  console.log('Create project...');
  const { res: createProjRes, json: createProjJson } = await request(
    `/api/pro/businesses/${businessId}/projects`,
    { method: 'POST', body: { name: `Accounting Smoke ${Date.now()}` } }
  );
  if (!createProjRes.ok) {
    throw new Error(`Create project failed (${createProjRes.status}) ref=${getLastRequestId()}`);
  }
  const projectId = (createProjJson as { id?: string })?.id;
  if (!projectId) throw new Error('Project creation returned no id.');

  console.log('Attach service without priceCents...');
  const quantity = 2;
  const { res: attachRes, json: attachJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
    { method: 'POST', body: { serviceId, quantity } }
  );
  if (!attachRes.ok) {
    throw new Error(`Attach service failed (${attachRes.status}) ref=${getLastRequestId()}`);
  }
  const attachedPriceRaw = (attachJson as { priceCents?: string | null })?.priceCents;
  if (!attachedPriceRaw) throw new Error('ProjectService priceCents missing after attach.');
  const attachedPrice = toBigInt(attachedPriceRaw);
  if (attachedPrice !== serviceDefault) {
    throw new Error(
      `ProjectService price mismatch: expected ${serviceDefault.toString()} got ${attachedPrice.toString()}`
    );
  }

  console.log('Pricing...');
  const { res: pricingRes, json: pricingJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/pricing`
  );
  if (!pricingRes.ok) throw new Error(`Pricing failed (${pricingRes.status}) ref=${getLastRequestId()}`);
  const pricing = (pricingJson as { pricing?: { items?: Array<{ unitPriceCents?: string; quantity?: number; totalCents?: string }>; totalCents?: string } })
    ?.pricing;
  if (!pricing?.items?.length) throw new Error('Pricing items missing.');
  const pricingItem = pricing.items[0];
  const pricingUnit = toBigInt(pricingItem.unitPriceCents ?? '0');
  if (pricingUnit !== attachedPrice) {
    throw new Error(`Pricing unit mismatch: ${pricingUnit.toString()} vs ${attachedPrice.toString()}`);
  }
  const expectedTotal = pricingUnit * BigInt(quantity);
  const pricingTotal = toBigInt(pricing.totalCents ?? '0');
  if (pricingTotal !== expectedTotal) {
    throw new Error(`Pricing total mismatch: ${pricingTotal.toString()} vs ${expectedTotal.toString()}`);
  }

  console.log('Create quote...');
  const { res: quoteRes, json: quoteJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
    { method: 'POST' }
  );
  if (!quoteRes.ok) throw new Error(`Quote create failed (${quoteRes.status}) ref=${getLastRequestId()}`);
  const quote = (quoteJson as { quote?: { id?: string; totalCents?: string; items?: Array<{ unitPriceCents?: string; quantity?: number; totalCents?: string }> } })
    ?.quote;
  if (!quote?.id) throw new Error('Quote id missing.');
  const quoteItem = quote.items?.[0];
  if (!quoteItem) throw new Error('Quote items missing.');
  const quoteUnit = toBigInt(quoteItem.unitPriceCents ?? '0');
  if (quoteUnit !== pricingUnit) {
    throw new Error(`Quote unit mismatch: ${quoteUnit.toString()} vs ${pricingUnit.toString()}`);
  }
  const quoteTotal = toBigInt(quote.totalCents ?? '0');
  if (quoteTotal !== pricingTotal) {
    throw new Error(`Quote total mismatch: ${quoteTotal.toString()} vs ${pricingTotal.toString()}`);
  }

  console.log('Mark quote SENT...');
  const sent = await request(`/api/pro/businesses/${businessId}/quotes/${quote.id}`, {
    method: 'PATCH',
    body: { status: 'SENT' },
  });
  if (!sent.res.ok) throw new Error(`Quote SENT failed (${sent.res.status}) ref=${getLastRequestId()}`);

  console.log('Create invoice from quote...');
  const { res: invRes, json: invJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${quote.id}/invoices`,
    { method: 'POST' }
  );
  if (!invRes.ok) throw new Error(`Invoice create failed (${invRes.status}) ref=${getLastRequestId()}`);
  const invoice = (invJson as { invoice?: { totalCents?: string; items?: Array<{ unitPriceCents?: string; totalCents?: string }> } })?.invoice;
  if (!invoice?.items?.length) throw new Error('Invoice items missing.');
  const invoiceTotal = toBigInt(invoice.totalCents ?? '0');
  if (invoiceTotal !== quoteTotal) {
    throw new Error(`Invoice total mismatch: ${invoiceTotal.toString()} vs ${quoteTotal.toString()}`);
  }

  console.log('OK accounting chain.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
