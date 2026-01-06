/**
 * Smoke test: références (catégories/tags/numérotation/automations)
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:references
 * Fallback: ADMIN_EMAIL/ADMIN_PASSWORD si TEST_* absents.
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
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}) ${JSON.stringify(json)}`);
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
    (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found to run smoke.');

  console.log('List references (CATEGORY)…');
  const { res: listRes } = await request(`/api/pro/businesses/${businessId}/references?type=CATEGORY`);
  if (!listRes.ok) throw new Error(`List failed (${listRes.status}) ref=${getLastRequestId()}`);

  const uniq = `Smoke-${Date.now()}`;

  console.log('Create reference…');
  const { res: createRes, json: createJson } = await request(
    `/api/pro/businesses/${businessId}/references`,
    {
      method: 'POST',
      body: { type: 'CATEGORY', name: uniq, value: 'test' },
    }
  );
  if (!createRes.ok) throw new Error(`Create failed (${createRes.status}) ref=${getLastRequestId()}`);
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
  if (!patchRes.ok) throw new Error(`Patch failed (${patchRes.status}) ref=${getLastRequestId()}`);

  console.log('Delete reference…');
  const { res: deleteRes } = await request(
    `/api/pro/businesses/${businessId}/references/${refId}`,
    { method: 'DELETE' }
  );
  if (!deleteRes.ok) throw new Error(`Delete failed (${deleteRes.status}) ref=${getLastRequestId()}`);

  console.log('Verify deletion…');
  const { res: finalList, json: finalJson } = await request(
    `/api/pro/businesses/${businessId}/references?type=CATEGORY&includeArchived=true`
  );
  if (!finalList.ok) throw new Error(`Final list failed (${finalList.status}) ref=${getLastRequestId()}`);
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
