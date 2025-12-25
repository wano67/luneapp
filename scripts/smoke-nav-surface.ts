/**
 * Authenticated smoke for Docs hub + Finances surface + legacy redirects.
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm smoke:nav-surface
 */

import { createRequester, getOrigin, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl =
  process.env.SMOKE_BASE_URL?.trim() || process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function login() {
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
    const body = typeof json === 'string' ? json : JSON.stringify(json);
    throw new Error(
      `Login failed (${res.status}) for /api/auth/login body=${body?.slice(0, 200) ?? '<empty>'}`
    );
  }
  console.log(`OK login (${creds.label}) -> ${res.status}`);
  return creds;
}

async function pickBusinessId(): Promise<string> {
  const { res, json } = await request('/api/pro/businesses');
  if (!res.ok) throw new Error(`/api/pro/businesses failed with ${res.status}`);
  const items = (json as { items?: Array<{ business?: { id?: string } }> })?.items ?? [];
  const bizId = items[0]?.business?.id;
  if (!bizId) throw new Error('No business found for smoke-nav-surface');
  console.log(`OK business picked -> ${bizId}`);
  return bizId;
}

async function assertOk(path: string) {
  const { res } = await request(path, { allowError: true });
  if (res.status >= 400) {
    const body = await res.text();
    throw new Error(`${path} expected 2xx, got ${res.status}, body=${body.slice(0, 200)}`);
  }
  console.log(`OK ${path} ${res.status}`);
}

async function assertRedirect(path: string, expectedSuffix: string) {
  const { res, json } = await request(path, { allowError: true, redirect: 'manual' });
  if (![301, 302, 303, 307, 308].includes(res.status)) {
    const body =
      typeof json === 'string'
        ? json
        : json
          ? JSON.stringify(json)
          : await res.text().catch(() => '');
    const loc = res.headers.get('location') || '';
    throw new Error(
      `${path} expected redirect, got ${res.status} Location="${loc}" body=${(body ?? '').slice(0, 200)}`
    );
  }
  const loc = res.headers.get('location') || '';
  if (!loc.endsWith(expectedSuffix)) {
    throw new Error(`${path} redirect mismatch: got "${loc}", expected suffix "${expectedSuffix}"`);
  }
  console.log(`OK ${path} ${res.status} Location=${loc}`);
}

async function main() {
  console.log(`Base URL: ${baseUrl} (origin=${getOrigin(baseUrl)})`);
  const creds = await login();
  if (!creds) return;

  const bizId = await pickBusinessId();

  // Docs hub should render (no redirect to login once authenticated).
  await assertOk('/app/docs');

  // Finances surface tab
  await assertOk(`/app/pro/${bizId}/finances?tab=vat`);
  console.log('OK finances surface');

  // Legacy route should redirect to surface tab
  await assertRedirect(`/app/pro/${bizId}/finances/vat`, `/app/pro/${bizId}/finances?tab=vat`);
  console.log('OK finances legacy redirect');

  // Settings surface (tabbed)
  await assertOk(`/app/pro/${bizId}/settings?tab=team`);
  console.log('OK settings surface');

  // Legacy settings route should redirect to surface tab
  await assertRedirect(
    `/app/pro/${bizId}/settings/team`,
    `/app/pro/${bizId}/settings?tab=team`
  );
  console.log('OK settings legacy redirect');

  console.log('smoke-nav-surface OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
