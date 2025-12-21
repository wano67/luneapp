/**
 * Smoke test: finance advanced endpoints (treasury, vat, forecasting).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:finance-advanced
 * Fallback: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* absent.
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
    console.log('Skip finance-advanced smoke (TEST_EMAIL/TEST_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD required).');
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

  console.log('Treasury…');
  const { res: treasuryRes, json: treasuryJson } = await request(
    `/api/pro/businesses/${businessId}/finances/treasury`
  );
  if (!treasuryRes.ok) throw new Error(`Treasury failed (${treasuryRes.status}) ref=${lastRequestId}`);
  const monthly = (treasuryJson as { monthly?: Array<unknown> })?.monthly ?? [];
  if (!Array.isArray(monthly) || monthly.length === 0) {
    throw new Error('Treasury monthly empty or invalid');
  }

  console.log('VAT…');
  const { res: vatRes } = await request(`/api/pro/businesses/${businessId}/finances/vat`);
  if (!vatRes.ok) throw new Error(`VAT failed (${vatRes.status}) ref=${lastRequestId}`);

  console.log('Forecasting…');
  const { res: forecastRes, json: forecastJson } = await request(
    `/api/pro/businesses/${businessId}/finances/forecasting`
  );
  if (!forecastRes.ok) throw new Error(`Forecasting failed (${forecastRes.status}) ref=${lastRequestId}`);
  const history = (forecastJson as { history?: Array<unknown> })?.history ?? [];
  const projections = (forecastJson as { projections?: Array<unknown> })?.projections ?? [];
  if (!Array.isArray(history) || !Array.isArray(projections)) {
    throw new Error('Forecast payload invalid');
  }

  console.log('Smoke finance advanced OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
