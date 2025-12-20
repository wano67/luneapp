/**
 * Smoke test: Finance wiring (payments -> dashboard).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm tsx scripts/smoke-finance-wiring.ts
 * Fallback envs: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* absent.
 *
 * Steps:
 *  - Login
 *  - Pick first business
 *  - GET dashboard (capture MTD income/net)
 *  - POST finance INCOME (category=PAYMENT)
 *  - GET dashboard again and assert MTD income increased
 *  - Cleanup: DELETE finance created
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

async function login(): Promise<void> {
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
  }
}

async function main() {
  if (!email || !password) {
    console.log('Skip finance smoke (TEST_EMAIL/TEST_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD required).');
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
  if (!businessId) throw new Error('No business found to run smoke.');

  console.log(`Business ${businessId}`);

  console.log('Dashboard before…');
  const { res: dashBeforeRes, json: dashBefore } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashBeforeRes.ok) throw new Error(`Dashboard failed (${dashBeforeRes.status}) ref=${lastRequestId}`);
  const beforeIncome = BigInt(
    (dashBefore as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  console.log('Create finance (payment)…');
  const amount = 123.45;
  const today = new Date().toISOString();
  const { res: createRes, json: createJson } = await request(
    `/api/pro/businesses/${businessId}/finances`,
    {
      method: 'POST',
      body: {
        type: 'INCOME',
        amount,
        category: 'PAYMENT',
        date: today,
        metadata: {
          clientName: 'Smoke Client',
          status: 'PAID',
          method: 'VIREMENT',
          receivedAt: today,
          expectedAt: today,
          currency: 'EUR',
        },
      },
    }
  );
  if (!createRes.ok) throw new Error(`Create finance failed (${createRes.status}) ref=${lastRequestId}`);
  const financeId = (createJson as { item?: { id?: string } })?.item?.id;

  console.log('Dashboard after…');
  const { res: dashAfterRes, json: dashAfter } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashAfterRes.ok) throw new Error(`Dashboard failed (${dashAfterRes.status}) ref=${lastRequestId}`);
  const afterIncome = BigInt(
    (dashAfter as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  if (afterIncome <= beforeIncome) {
    throw new Error(
      `MTD income did not increase (before ${beforeIncome}, after ${afterIncome}) ref=${lastRequestId}`
    );
  }
  console.log('Income increased as expected.');

  if (financeId) {
    console.log('Cleanup…');
    const { res: delRes } = await request(
      `/api/pro/businesses/${businessId}/finances/${financeId}`,
      { method: 'DELETE' }
    );
    if (!delRes.ok) {
      console.warn(`Cleanup failed (${delRes.status}) ref=${lastRequestId}`);
    }
  }

  console.log('Smoke finance wiring OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
