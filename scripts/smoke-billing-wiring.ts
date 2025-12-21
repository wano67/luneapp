/**
 * Smoke test: project -> pricing -> quote PDF -> invoice PDF -> payment -> finance/dashboard.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:billing
 *   (fallback env: ADMIN_EMAIL/ADMIN_PASSWORD)
 */

type FetchOpts = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const email = process.env.TEST_EMAIL || process.env.ADMIN_EMAIL;
const password = process.env.TEST_PASSWORD || process.env.ADMIN_PASSWORD;

let cookie: string | null = null;
let lastRequestId: string | null = null;

function extractCookie(setCookie: string | null) {
  if (!setCookie) return;
  const auth = setCookie.split(',').find((c) => c.trim().startsWith('auth_token='));
  if (auth) cookie = auth;
}

function getRequestId(res: Response) {
  return res.headers.get('x-request-id')?.trim() || null;
}

async function request(path: string, opts: FetchOpts = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  extractCookie(res.headers.get('set-cookie'));
  lastRequestId = getRequestId(res);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  return { res, json };
}

async function requestBinary(path: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { ...(cookie ? { Cookie: cookie } : {}) },
  });
  lastRequestId = getRequestId(res);
  const buf = await res.arrayBuffer();
  return { res, buf };
}

async function login(): Promise<void> {
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
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
  if (!email || !password) {
    console.log('Skip smoke: TEST_EMAIL/TEST_PASSWORD (or ADMIN_EMAIL/ADMIN_PASSWORD) required.');
    return;
  }

  console.log(`Base URL: ${baseUrl}`);
  console.log('Login…');
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${lastRequestId}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');

  console.log(`Business ${businessId}`);

  console.log('Dashboard (before)…');
  const { res: dashBeforeRes, json: dashBefore } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashBeforeRes.ok) throw new Error(`Dashboard before failed (${dashBeforeRes.status}) ref=${lastRequestId}`);
  const beforeIncome = BigInt(
    (dashBefore as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  console.log('Fetch services…');
  const { res: servicesRes, json: servicesJson } = await request(
    `/api/pro/businesses/${businessId}/services`
  );
  if (!servicesRes.ok) throw new Error(`Services failed (${servicesRes.status}) ref=${lastRequestId}`);
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
    if (!createSvcRes.ok) throw new Error(`Create service failed (${createSvcRes.status}) ref=${lastRequestId}`);
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
    throw new Error(`Create project failed (${createProjRes.status}) ref=${lastRequestId}`);
  const projectId = (createProjJson as { id?: string })?.id;
  if (!projectId) throw new Error('Project creation returned no id.');
  const { res: attachRes, json: attachJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
    { method: 'POST', body: { serviceId, quantity: 1, priceCents: 10000 } }
  );
  if (!attachRes.ok)
    throw new Error(`Attach service failed (${attachRes.status}) ref=${lastRequestId} json=${JSON.stringify(attachJson)}`);

  console.log(`Project ${projectId}`);

  console.log('Pricing…');
  const { res: pricingRes, json: pricingJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/pricing`
  );
  if (!pricingRes.ok) throw new Error(`Pricing failed (${pricingRes.status}) ref=${lastRequestId}`);
  const totalCents = toBigInt((pricingJson as { pricing?: { totalCents?: string } })?.pricing?.totalCents ?? '0');
  if (totalCents <= BigInt(0)) throw new Error('Pricing total is zero or invalid.');

  console.log('Create quote…');
  const { res: quoteRes, json: quoteJson } = await request(
    `/api/pro/businesses/${businessId}/projects/${projectId}/quotes`,
    { method: 'POST' }
  );
  if (!quoteRes.ok) throw new Error(`Quote create failed (${quoteRes.status}) ref=${lastRequestId}`);
  const quoteId = (quoteJson as { quote?: { id?: string } })?.quote?.id;
  if (!quoteId) throw new Error('Quote id missing.');

  console.log('Quote PDF…');
  const { res: quotePdfRes, buf: quotePdfBuf } = await requestBinary(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/pdf`
  );
  if (!quotePdfRes.ok) throw new Error(`Quote PDF failed (${quotePdfRes.status}) ref=${lastRequestId}`);
  if (quotePdfBuf.byteLength < 1000) throw new Error('Quote PDF too small.');

  console.log('Mark quote SENT then SIGNED…');
  const toSigned = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!toSigned.res.ok) throw new Error(`Quote SENT failed (${toSigned.res.status}) ref=${lastRequestId}`);
  const toSigned2 = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}`,
    { method: 'PATCH', body: { status: 'SIGNED' } }
  );
  if (!toSigned2.res.ok) throw new Error(`Quote SIGNED failed (${toSigned2.res.status}) ref=${lastRequestId}`);

  console.log('Create invoice from quote…');
  const { res: invRes, json: invJson } = await request(
    `/api/pro/businesses/${businessId}/quotes/${quoteId}/invoices`,
    { method: 'POST' }
  );
  if (!invRes.ok) throw new Error(`Invoice create failed (${invRes.status}) ref=${lastRequestId}`);
  const invoice = (invJson as { invoice?: { id?: string; totalCents?: string } })?.invoice;
  if (!invoice?.id) throw new Error('Invoice id missing.');
  const invoiceTotal = toBigInt(invoice.totalCents ?? '0');

  console.log('Invoice PDF…');
  const { res: invPdfRes, buf: invPdfBuf } = await requestBinary(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}/pdf`
  );
  if (!invPdfRes.ok) throw new Error(`Invoice PDF failed (${invPdfRes.status}) ref=${lastRequestId}`);
  if (invPdfBuf.byteLength < 1000) throw new Error('Invoice PDF too small.');

  console.log('Mark invoice SENT then PAID…');
  const invSent = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}`,
    { method: 'PATCH', body: { status: 'SENT' } }
  );
  if (!invSent.res.ok) throw new Error(`Invoice SENT failed (${invSent.res.status}) ref=${lastRequestId}`);
  const invPaid = await request(
    `/api/pro/businesses/${businessId}/invoices/${invoice.id}`,
    { method: 'PATCH', body: { status: 'PAID' } }
  );
  if (!invPaid.res.ok) throw new Error(`Invoice PAID failed (${invPaid.res.status}) ref=${lastRequestId}`);

  console.log('Dashboard (after)…');
  const { res: dashAfterRes, json: dashAfter } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashAfterRes.ok) throw new Error(`Dashboard after failed (${dashAfterRes.status}) ref=${lastRequestId}`);
  const afterIncome = BigInt(
    (dashAfter as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  if (afterIncome - beforeIncome < invoiceTotal) {
    throw new Error(
      `MTD income did not increase enough (before ${beforeIncome}, after ${afterIncome}, invoice ${invoiceTotal}) ref=${lastRequestId}`
    );
  }

  console.log('Smoke billing wiring OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
