/**
 * Smoke test: references wiring consumption (services with category + tags).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:references-consumption
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
  const value = res.headers.get('x-request-id')?.trim() || null;
  if (value) lastRequestId = value;
  return value;
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
  getRequestId(res);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  return { res, json };
}

async function login(): Promise<void> {
  if (!email || !password) {
    throw new Error('Missing TEST_EMAIL/TEST_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD');
  }
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
  }
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${lastRequestId}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found.');
  console.log(`Business ${businessId}`);

  let serviceId: string | null = null;
  let categoryId: string | null = null;
  let tagId: string | null = null;
  try {
    const uniq = `Smoke-${Date.now()}`;
    console.log('Create category…');
    const { res: catRes, json: catJson } = await request(
      `/api/pro/businesses/${businessId}/references`,
      { method: 'POST', body: { type: 'CATEGORY', name: `${uniq}-cat` } }
    );
    if (!catRes.ok) throw new Error(`Create category failed (${catRes.status}) ref=${lastRequestId}`);
    categoryId = (catJson as { item?: { id?: string } })?.item?.id ?? null;

    console.log('Create tag…');
    const { res: tagRes, json: tagJson } = await request(
      `/api/pro/businesses/${businessId}/references`,
      { method: 'POST', body: { type: 'TAG', name: `${uniq}-tag` } }
    );
    if (!tagRes.ok) throw new Error(`Create tag failed (${tagRes.status}) ref=${lastRequestId}`);
    tagId = (tagJson as { item?: { id?: string } })?.item?.id ?? null;

    console.log('Create service…');
    const code = `SER-${uniq}`;
    const { res: serviceRes, json: serviceJson } = await request(
      `/api/pro/businesses/${businessId}/services`,
      {
        method: 'POST',
        body: {
          code,
          name: `Service ${uniq}`,
          categoryReferenceId: categoryId,
          tagReferenceIds: tagId ? [tagId] : [],
        },
      }
    );
    if (!serviceRes.ok) throw new Error(`Create service failed (${serviceRes.status}) ref=${lastRequestId}`);
    serviceId = (serviceJson as { id?: string; item?: { id?: string } })?.item?.id ?? null;
    if (!serviceId) serviceId = (serviceJson as { id?: string })?.id ?? null;
    if (!serviceId) throw new Error('Service created but no id.');

    console.log('Patch service references…');
    const { res: patchRes } = await request(
      `/api/pro/businesses/${businessId}/services/${serviceId}`,
      {
        method: 'PATCH',
        body: { categoryReferenceId: categoryId, tagReferenceIds: tagId ? [tagId] : [] },
      }
    );
    if (!patchRes.ok) throw new Error(`Patch service failed (${patchRes.status}) ref=${lastRequestId}`);

    console.log('Get service detail…');
    const { res: detailRes, json: detailJson } = await request(
      `/api/pro/businesses/${businessId}/services/${serviceId}`
    );
    if (!detailRes.ok) throw new Error(`Detail failed (${detailRes.status}) ref=${lastRequestId}`);
    const detail = detailJson as {
      categoryReferenceId?: string | null;
      tagReferences?: Array<{ id?: string }>;
    };
    if ((categoryId && detail.categoryReferenceId !== categoryId) || !detail.tagReferences?.find((t) => t.id === tagId)) {
      throw new Error('References not persisted on service detail.');
    }

    console.log('Filter services by tag…');
    const { res: listRes, json: listJson } = await request(
      `/api/pro/businesses/${businessId}/services?tagReferenceId=${tagId}`
    );
    if (!listRes.ok) throw new Error(`List filter failed (${listRes.status}) ref=${lastRequestId}`);
    const found = (listJson as { items?: Array<{ id?: string }> })?.items?.find((s) => s.id === serviceId);
    if (!found) throw new Error('Filtered services did not return the created service.');

    console.log('Smoke references consumption OK.');
  } finally {
    if (serviceId) {
      await request(`/api/pro/businesses/${businessId}/services/${serviceId}`, { method: 'DELETE' });
    }
    if (categoryId) {
      await request(`/api/pro/businesses/${businessId}/references/${categoryId}`, { method: 'DELETE' });
    }
    if (tagId) {
      await request(`/api/pro/businesses/${businessId}/references/${tagId}`, { method: 'DELETE' });
    }
  }
}

main().catch((err) => {
  console.error(err);
  if (lastRequestId) console.error(`Last request id: ${lastRequestId}`);
  process.exit(1);
});
