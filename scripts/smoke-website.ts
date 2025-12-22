/**
 * Smoke test: websiteUrl on clients (and business update) roundtrip.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 SMOKE_CREDS=admin pnpm smoke:website
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request, getLastRequestId } = createRequester(baseUrl);

async function login(): Promise<void> {
  let creds;
  try {
    creds = getSmokeCreds({ preferAdmin: true });
  } catch (err) {
    handleMissingCreds((err as Error).message);
    return;
  }
  const { res, json } = await request('/api/auth/login', {
    method: 'POST',
    body: { email: creds.email, password: creds.password },
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
}

function extractId(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
}

function extractWebsite(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  console.log('Login…');
  await login();

  console.log('Fetch businesses…');
  const { res: bizRes, json: bizJson } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`Businesses failed (${bizRes.status}) ref=${getLastRequestId()}`);
  const businessId =
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id ??
    extractId((bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business);
  if (!businessId) throw new Error('No business found for website smoke.');

  const baseName = `Smoke Website ${Date.now()}`;
  const websiteA = 'example.com';
  const websiteB = 'https://news.ycombinator.com';
  const websiteAHost = extractWebsite(`https://${websiteA}`);
  const targetHost = extractWebsite(websiteB);

  console.log('Create client with websiteUrl…');
  const { res: createRes, json: createJson } = await request(
    `/api/pro/businesses/${businessId}/clients`,
    {
      method: 'POST',
      body: { name: baseName, websiteUrl: websiteA },
    }
  );
  if (!createRes.ok) throw new Error(`Client create failed (${createRes.status}) ref=${getLastRequestId()}`);
  const clientId =
    (createJson as { id?: string })?.id ??
    extractId((createJson as { client?: { id?: string } }).client);
  if (!clientId) throw new Error('Client id missing after creation.');

  console.log('Patch client websiteUrl…');
  const { res: patchRes, json: patchJson } = await request(
    `/api/pro/businesses/${businessId}/clients/${clientId}`,
    {
      method: 'PATCH',
      body: { websiteUrl: websiteB },
    }
  );
  if (!patchRes.ok) throw new Error(`Client patch failed (${patchRes.status}) ref=${getLastRequestId()}`);
  const patchedWebsite = (patchJson as { item?: { websiteUrl?: string | null } })?.item?.websiteUrl ?? null;
  const patchedHost = extractWebsite(patchedWebsite);
  if (!patchedHost || patchedHost !== targetHost) {
    throw new Error(`Patched website mismatch (${patchedWebsite} vs ${websiteB}) ref=${getLastRequestId()}`);
  }

  console.log('Verify list includes websiteUrl…');
  const { res: listRes, json: listJson } = await request(
    `/api/pro/businesses/${businessId}/clients?q=${encodeURIComponent(baseName)}`
  );
  if (!listRes.ok) throw new Error(`Client list failed (${listRes.status}) ref=${getLastRequestId()}`);
  const listItem = (listJson as { items?: Array<{ id?: string; websiteUrl?: string }> })?.items?.find(
    (c) => c.id === clientId
  );
  if (!listItem) throw new Error(`Client ${clientId} not found in list ref=${getLastRequestId()}`);
  const listHost = extractWebsite(listItem.websiteUrl);
  if (listHost !== targetHost) {
    throw new Error(`List website mismatch (${listItem.websiteUrl}) ref=${getLastRequestId()}`);
  }

  console.log('Patch business websiteUrl…');
  const { res: bizPatchRes, json: bizPatchJson } = await request(
    `/api/pro/businesses/${businessId}`,
    {
      method: 'PATCH',
      body: { websiteUrl: websiteA },
    }
  );
  if (!bizPatchRes.ok) {
    throw new Error(`Business patch failed (${bizPatchRes.status}) ref=${getLastRequestId()}`);
  }
  const bizWebsite = (bizPatchJson as { item?: { websiteUrl?: string | null } })?.item?.websiteUrl ?? null;
  if (extractWebsite(bizWebsite) !== websiteAHost) {
    throw new Error(`Business website mismatch (${bizWebsite}) ref=${getLastRequestId()}`);
  }

  console.log('Website smoke passed.');
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
