/**
 * Smoke test: références (catégories/tags/numérotation/automations)
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:references
 * Fallback: ADMIN_EMAIL/ADMIN_PASSWORD si TEST_* absents.
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
    console.log('Skip references smoke (TEST_EMAIL/TEST_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD required).');
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

  console.log('List references (CATEGORY)…');
  const { res: listRes } = await request(`/api/pro/businesses/${businessId}/references?type=CATEGORY`);
  if (!listRes.ok) throw new Error(`List failed (${listRes.status}) ref=${lastRequestId}`);

  const uniq = `Smoke-${Date.now()}`;

  console.log('Create reference…');
  const { res: createRes, json: createJson } = await request(
    `/api/pro/businesses/${businessId}/references`,
    {
      method: 'POST',
      body: { type: 'CATEGORY', name: uniq, value: 'test' },
    }
  );
  if (!createRes.ok) throw new Error(`Create failed (${createRes.status}) ref=${lastRequestId}`);
  const refId = (createJson as { item?: { id?: string } })?.item?.id;
  if (!refId) throw new Error('Create succeeded but no id returned.');

  console.log('Patch reference…');
  const { res: patchRes } = await request(
    `/api/pro/businesses/${businessId}/references/${refId}`,
    {
      method: 'PATCH',
      body: { name: `${uniq}-updated`, value: 'updated' },
    }
  );
  if (!patchRes.ok) throw new Error(`Patch failed (${patchRes.status}) ref=${lastRequestId}`);

  console.log('Delete reference…');
  const { res: deleteRes } = await request(
    `/api/pro/businesses/${businessId}/references/${refId}`,
    { method: 'DELETE' }
  );
  if (!deleteRes.ok) throw new Error(`Delete failed (${deleteRes.status}) ref=${lastRequestId}`);

  console.log('Verify deletion…');
  const { res: finalList, json: finalJson } = await request(
    `/api/pro/businesses/${businessId}/references?type=CATEGORY&includeArchived=true`
  );
  if (!finalList.ok) throw new Error(`Final list failed (${finalList.status}) ref=${lastRequestId}`);
  const stillThere = (finalJson as { items?: Array<{ id?: string; name?: string }> })?.items?.find(
    (item) => item.id === refId
  );
  if (stillThere) throw new Error('Reference still present after delete.');

  console.log('Smoke references OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
