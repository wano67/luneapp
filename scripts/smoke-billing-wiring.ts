/**
 * Smoke test: project -> pricing -> quote PDF -> invoice PDF -> payment -> finance/dashboard.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:billing
 *   (fallback env: ADMIN_EMAIL/ADMIN_PASSWORD)
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request, requestBinary, getLastRequestId } = createRequester(baseUrl);

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
  console.log('Login…');
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${getLastRequestId()}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');

  console.log(`Business ${businessId}`);

  console.log('Dashboard (before)…');
  const { res: dashBeforeRes, json: dashBefore } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashBeforeRes.ok) throw new Error(`Dashboard before failed (${dashBeforeRes.status}) ref=${getLastRequestId()}`);
  const beforeIncome = BigInt(
    (dashBefore as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  console.log('Fetch services…');
  const { res: servicesRes, json: servicesJson } = await request(
    `/api/pro/businesses/${businessId}/services`
  );
  if (!servicesRes.ok) throw new Error(`Services failed (${servicesRes.status}) ref=${getLastRequestId()}`);
  let serviceId =
    (servicesJson as { items?: Array<{ id?: string }> })?.items?.[0]?.id ??
    (servicesJson as { items?: Array<{ service?: { id?: string } }> })?.items?.[0]?.service?.id;
  if (!serviceId) {
    console.log('No service available, creating a temporary one…');
    const code = `SER-${Date.now()}`;
    const { res: createSvcRes, json: createSvcJson } = await request(
      `/api/pro/businesses/${businessId}/services`,
      {
        method: 'POST',
        body: {
          code,
          name: `Smoke Service ${Date.now()}`,
          description: 'Smoke billing',
          defaultPriceCents: 10000,
        },
      }
    );
    if (!createSvcRes.ok) throw new Error(`Create service failed (${createSvcRes.status}) ref=${getLastRequestId()}`);
    serviceId = (createSvcJson as { id?: string })?.id ?? null;
    if (!serviceId) throw new Error('Service creation returned no id.');
  }

  console.log('Create project and attach service…');
  const name = `Billing Smoke ${Date.now()}`;
  const { res: createProjRes, json: createProjJson } = await request(
    `/api/pro/businesses/${businessId}/projects`,
    { method: 'POST', body: { name } }
  );
  if (!createProjRes.ok)
    throw new Error(`Create project failed (${createProjRes.status}) ref=${getLastRequestId()}`);
  const projectId = (createProjJson as { id?: string })?.id;
  if (!projectId) throw new Error('Project creation returned no id.');
  const { res: attachRes, json: attachJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
    { method: 'POST', body: { serviceId, quantity: 1, priceCents: 10000 } }
  );
  if (!attachRes.ok)
    throw new Error(`Attach service failed (${attachRes.status}) ref=${getLastRequestId()} json=${JSON.stringify(attachJson)}`);

  console.log(`Project ${projectId}`);

  console.log('Pricing…');
  const { res: pricingRes, json: pricingJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/pricing`
  );
  if (!pricingRes.ok) throw new Error(`Pricing failed (${pricingRes.status}) ref=${getLastRequestId()}`);
  const totalCents = toBigInt((pricingJson as { pricing?: { totalCents?: string } })?.pricing?.totalCents ?? '0');
  if (totalCents <= BigInt(0)) throw new Error('Pricing total is zero or invalid.');

  console.log('Create quote…');
  const { res: quoteRes, json: quoteJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
    { method: 'POST' }
  );
  if (!quoteRes.ok) throw new Error(`Quote create failed (${quoteRes.status}) ref=${getLastRequestId()}`);
  const quoteId = (quoteJson as { quote?: { id?: string } })?.quote?.id;
  if (!quoteId) throw new Error('Quote id missing.');

  console.log('Quote PDF…');
  const { res: quotePdfRes, buf: quotePdfBuf } = await requestBinary(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/pdf`
  );
  if (!quotePdfRes.ok) throw new Error(`Quote PDF failed (${quotePdfRes.status}) ref=${getLastRequestId()}`);
  if (quotePdfBuf.byteLength < 1000) throw new Error('Quote PDF too small.');

  console.log('Mark quote SENT then SIGNED…');
  const sentResp = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!sentResp.res.ok) throw new Error(`Quote SENT failed (${sentResp.res.status}) ref=${getLastRequestId()}`);
  const quoteNumber =
    (sentResp.json as { quote?: { number?: string | null } })?.quote?.number ?? null;
  if (!quoteNumber || !/^[A-Za-z0-9_-]+-\d{4}-\d{4}$/.test(quoteNumber)) {
    throw new Error(`Quote number format invalid (${quoteNumber}) ref=${getLastRequestId()}`);
  }
  const toSigned2 = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SIGNED' } }
  );
  if (!toSigned2.res.ok) throw new Error(`Quote SIGNED failed (${toSigned2.res.status}) ref=${getLastRequestId()}`);
  const signedNumber =
    (toSigned2.json as { quote?: { number?: string | null } })?.quote?.number ?? null;
  if (signedNumber !== quoteNumber) {
    throw new Error(`Quote number changed after SIGNED (${quoteNumber} -> ${signedNumber}) ref=${getLastRequestId()}`);
  }

  console.log('Create invoice from quote…');
  const { res: invRes, json: invJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
    { method: 'POST' }
  );
  if (!invRes.ok) throw new Error(`Invoice create failed (${invRes.status}) ref=${getLastRequestId()}`);
  const invoice = (invJson as { invoice?: { id?: string; totalCents?: string } })?.invoice;
  if (!invoice?.id) throw new Error('Invoice id missing.');
  const invoiceTotal = toBigInt(invoice.totalCents ?? '0');

  console.log('Invoice PDF…');
  const { res: invPdfRes, buf: invPdfBuf } = await requestBinary(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`
  );
  if (!invPdfRes.ok) throw new Error(`Invoice PDF failed (${invPdfRes.status}) ref=${getLastRequestId()}`);
  if (invPdfBuf.byteLength < 1000) throw new Error('Invoice PDF too small.');

  console.log('Mark invoice SENT then PAID…');
  const invSent = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!invSent.res.ok) throw new Error(`Invoice SENT failed (${invSent.res.status}) ref=${getLastRequestId()}`);
  const invoiceNumber =
    (invSent.json as { invoice?: { number?: string | null } })?.invoice?.number ?? null;
  if (!invoiceNumber || !/^[A-Za-z0-9_-]+-\d{4}-\d{4}$/.test(invoiceNumber)) {
    throw new Error(`Invoice number format invalid (${invoiceNumber}) ref=${getLastRequestId()}`);
  }
  const invPaid = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}`,
    { method: 'PATCH', body: { status: 'PAID' } }
  );
  if (!invPaid.res.ok) throw new Error(`Invoice PAID failed (${invPaid.res.status}) ref=${getLastRequestId()}`);
  const paidNumber =
    (invPaid.json as { invoice?: { number?: string | null } })?.invoice?.number ?? null;
  if (paidNumber !== invoiceNumber) {
    throw new Error(`Invoice number changed after PAID (${invoiceNumber} -> ${paidNumber}) ref=${getLastRequestId()}`);
  }

  console.log('Dashboard (after)…');
  const { res: dashAfterRes, json: dashAfter } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashAfterRes.ok) throw new Error(`Dashboard after failed (${dashAfterRes.status}) ref=${getLastRequestId()}`);
  const afterIncome = BigInt(
    (dashAfter as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  if (afterIncome - beforeIncome < invoiceTotal) {
    throw new Error(
      `MTD income did not increase enough (before ${beforeIncome}, after ${afterIncome}, invoice ${invoiceTotal}) ref=${getLastRequestId()}`
    );
  }

  console.log('Smoke billing wiring OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
