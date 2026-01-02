/**
 * Authenticated smoke for Docs hub + Finances surface + legacy redirects.
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:3000 ADMIN_EMAIL=... ADMIN_PASSWORD=... pnpm smoke:nav-surface
 */

import { createRequester, getOrigin, getSmokeCreds } from './smoke-utils';

const baseUrl =
  process.env.SMOKE_BASE_URL?.trim() || process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function login() {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    console.log(`Missing smoke credentials: ${(err as Error).message}`);
    return null;
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

async function createAndFetchProject(bizId: string) {
  const projectName = `Smoke project ${Date.now()}`;
  const { res, json } = await request(`/api/pro/businesses/${bizId}/projects`, {
    method: 'POST',
    body: { name: projectName },
  });
  if (res.status !== 201) {
    const body = typeof json === 'string' ? json : JSON.stringify(json);
    throw new Error(`Project creation failed (${res.status}): ${body?.slice(0, 200) ?? '<empty>'}`);
  }
  const projectId = (json as { id?: string })?.id;
  if (!projectId) throw new Error('Project creation response missing id');
  console.log(`OK project created ${projectId}`);

  const { res: listRes, json: listJson } = await request(`/api/pro/businesses/${bizId}/projects`);
  if (!listRes.ok) {
    const body = typeof listJson === 'string' ? listJson : JSON.stringify(listJson);
    throw new Error(`/projects listing failed (${listRes.status}): ${body?.slice(0, 200) ?? '<empty>'}`);
  }

  const items = (listJson as { items?: Array<{ id?: string; name?: string }> })?.items ?? [];
  const found = items.find((p) => p.id === projectId || p.name === projectName);
  if (!found) {
    throw new Error(`Created project ${projectId} not returned by list (items=${items.length})`);
  }
  console.log(`OK project listed ${projectId}`);

  await assertOk(`/app/pro/${bizId}/projects`);
  await assertOk(`/app/pro/${bizId}/projects/${projectId}`);
}

async function runPublicSmoke() {
  await assertOk('/api/health');
  await assertOk('/');
  try {
    await assertOk('/about');
  } catch (err) {
    console.warn(`Skipping /about check: ${(err as Error).message}`);
  }
  console.log('smoke-nav-surface OK (public mode, no creds)');
}

async function main() {
  console.log(`Base URL: ${baseUrl} (origin=${getOrigin(baseUrl)})`);
  const creds = await login();
  if (!creds) {
    await runPublicSmoke();
    return;
  }

  const bizId = await pickBusinessId();

  await createAndFetchProject(bizId);

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
