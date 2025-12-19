/**
 * Smoke test for dev server: checks public pages + authenticated pages/APIs.
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:dev-routes
 * If credentials are missing, protected routes will be skipped.
 */

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

let cookie: string | null = null;

function extractCookie(setCookie: string | null) {
  if (!setCookie) return;
  const auth = setCookie.split(',').find((c) => c.trim().startsWith('auth_token='));
  if (auth) cookie = auth;
}

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  extractCookie(res.headers.get('set-cookie'));
  return res;
}

async function requestJson(path: string, init: RequestInit = {}) {
  const res = await request(path, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  return { res, json };
}

async function checkRoute(path: string) {
  const res = await request(path);
  if (res.status >= 500) throw new Error(`Route ${path} failed with ${res.status}`);
  console.log(`${path}: ${res.status}`);
}

async function login() {
  if (!email || !password) return false;
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: baseUrl },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Login failed (${res.status}): ${body}`);
  }
  extractCookie(res.headers.get('set-cookie'));
  return true;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);

  const publicRoutes = ['/', '/login', '/register'];
  for (const r of publicRoutes) {
    await checkRoute(r);
  }

  if (!email || !password) {
    console.log('No TEST_EMAIL/TEST_PASSWORD, skipping protected routes.');
    return;
  }

  console.log('Login...');
  await login();

  console.log('GET /api/auth/me');
  const me = await request('/api/auth/me');
  if (!me.ok) throw new Error(`/api/auth/me failed with ${me.status}`);

  console.log('Businesses…');
  const { res: bizRes, json: bizJson } = await requestJson('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`/api/pro/businesses failed with ${bizRes.status}`);
  const businessId = (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found to continue smoke tests.');

  const protectedPages = [
    '/app',
    '/app/pro',
    `/app/pro/${businessId}`,
    `/app/pro/${businessId}/clients`,
    `/app/pro/${businessId}/invites`,
  ];

  const { res: clientsRes, json: clientsJson } = await requestJson(
    `/api/pro/businesses/${businessId}/clients`
  );
  if (!clientsRes.ok) throw new Error(`/api/pro/businesses/${businessId}/clients failed with ${clientsRes.status}`);
  const clientId = (clientsJson as { items?: Array<{ id?: string }> })?.items?.[0]?.id;
  if (clientId) {
    protectedPages.push(`/app/pro/${businessId}/clients/${clientId}`);
  }

  console.log('Dashboard…');
  const dashboard = await request(`/api/pro/businesses/${businessId}/dashboard`);
  if (!dashboard.ok) throw new Error(`/api/pro/businesses/${businessId}/dashboard failed with ${dashboard.status}`);

  console.log('Invites list…');
  const invites = await request(`/api/pro/businesses/${businessId}/invites`);
  if (!invites.ok) throw new Error(`/api/pro/businesses/${businessId}/invites failed with ${invites.status}`);

  for (const r of protectedPages) {
    await checkRoute(r);
  }

  if (clientId) {
    console.log('Client detail…');
    const detail = await request(`/api/pro/businesses/${businessId}/clients/${clientId}`);
    if (!detail.ok) throw new Error(`/api/pro/businesses/${businessId}/clients/${clientId} failed with ${detail.status}`);
  }

  console.log('Smoke dev routes OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
