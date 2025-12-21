/**
 * Smoke test for dev server: checks public pages + authenticated pages/APIs.
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:dev-routes
 * If credentials are missing, protected routes will be skipped unless SMOKE_STRICT=1.
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function checkRoute(path: string) {
  const { res } = await request(path, { allowError: true });
  if (res.status >= 500) throw new Error(`Route ${path} failed with ${res.status}`);
  console.log(`${path}: ${res.status}`);
}

async function login(): Promise<boolean> {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return false;
  }

  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return true;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);

  const publicRoutes = ['/', '/login', '/register'];
  for (const r of publicRoutes) {
    await checkRoute(r);
  }

  console.log('Login...');
  const logged = await login();
  if (!logged) return;

  console.log('GET /api/auth/me');
  const me = await request('/api/auth/me');
  if (!me.res.ok) throw new Error(`/api/auth/me failed with ${me.res.status}`);

  console.log('Businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
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

  const { res: clientsRes, json: clientsJson } = await request(
    `/api/pro/businesses/${businessId}/clients`
  );
  if (!clientsRes.ok) throw new Error(`/api/pro/businesses/${businessId}/clients failed with ${clientsRes.status}`);
  const clientId = (clientsJson as { items?: Array<{ id?: string }> })?.items?.[0]?.id;
  if (clientId) {
    protectedPages.push(`/app/pro/${businessId}/clients/${clientId}`);
  }

  console.log('Dashboard…');
  const dashboard = await request(`/api/pro/businesses/${businessId}/dashboard`);
  if (!dashboard.res.ok)
    throw new Error(`/api/pro/businesses/${businessId}/dashboard failed with ${dashboard.res.status}`);

  console.log('Invites list…');
  const invites = await request(`/api/pro/businesses/${businessId}/invites`);
  if (!invites.res.ok) throw new Error(`/api/pro/businesses/${businessId}/invites failed with ${invites.res.status}`);

  for (const r of protectedPages) {
    await checkRoute(r);
  }

  if (clientId) {
    console.log('Client detail…');
    const detail = await request(`/api/pro/businesses/${businessId}/clients/${clientId}`);
    if (!detail.res.ok)
      throw new Error(`/api/pro/businesses/${businessId}/clients/${clientId} failed with ${detail.res.status}`);
  }

  console.log('Smoke dev routes OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
