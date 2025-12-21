/**
 * Smoke test: business settings.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:settings
 * Fallback: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* are absent.
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
    console.log('Skip settings smoke (TEST_EMAIL/TEST_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD required).');
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

  console.log('GET settings…');
  const { res: getRes, json: getJson } = await request(
    `/api/pro/businesses/${businessId}/settings`
  );
  if (!getRes.ok) throw new Error(`GET settings failed (${getRes.status}) ref=${lastRequestId}`);
  const currentTerms =
    (getJson as { item?: { paymentTermsDays?: number } })?.item?.paymentTermsDays ?? 0;

  console.log('PATCH settings…');
  const nextTerms = currentTerms + 1;
  const { res: patchRes } = await request(`/api/pro/businesses/${businessId}/settings`, {
    method: 'PATCH',
    body: { paymentTermsDays: nextTerms },
  });
  if (!patchRes.ok) throw new Error(`PATCH settings failed (${patchRes.status}) ref=${lastRequestId}`);

  console.log('GET settings again…');
  const { res: finalRes, json: finalJson } = await request(
    `/api/pro/businesses/${businessId}/settings`
  );
  if (!finalRes.ok) throw new Error(`Final GET failed (${finalRes.status}) ref=${lastRequestId}`);
  const finalTerms =
    (finalJson as { item?: { paymentTermsDays?: number } })?.item?.paymentTermsDays ?? 0;
  if (finalTerms !== nextTerms) {
    throw new Error(`paymentTermsDays not updated (expected ${nextTerms}, got ${finalTerms}) ref=${lastRequestId}`);
  }

  console.log('Smoke settings OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
