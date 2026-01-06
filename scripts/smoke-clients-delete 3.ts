/**
 * Smoke test for client bulk archive/delete rules.
 * Steps:
 * - login admin
 * - create client A (active)
 * - bulk DELETE (should fail: must be archived first)
 * - create client B, ARCHIVE, then DELETE (should succeed)
 */

import { createRequester, getSmokeCreds, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
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
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${JSON.stringify(json)}`);
  return true;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  const logged = await login();
  if (!logged) return;

  const { json: bizJson, res: bizRes } = await request('/api/pro/businesses');
  if (!bizRes.ok) throw new Error(`/api/pro/businesses failed ${bizRes.status}`);
  const businessId = (bizJson as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
  if (!businessId) throw new Error('No business found');

  // Create client A
  const nameA = `smoke-delete-a-${Date.now()}`;
  const createA = await request(`/api/pro/businesses/${businessId}/clients`, {
    method: 'POST',
    body: { name: nameA },
  });
  if (!createA.res.ok) throw new Error(`Create client A failed ${createA.res.status}`);
  const clientA = (createA.json as { id?: string })?.id;
  if (!clientA) throw new Error('No clientA id');

  // Try delete without archive -> should fail
  const delA = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientA], action: 'DELETE' },
  });
  if (!delA.res.ok) throw new Error(`Delete A call failed ${delA.res.status}`);
  const failedA = (delA.json as { failed?: Array<{ id: string; reason: string }> }).failed ?? [];
  if (!failedA.some((f) => f.id === clientA && f.reason.includes('archived'))) {
    throw new Error(`Expected archive failure for client A, got ${JSON.stringify(delA.json)}`);
  }
  console.log('Delete without archive correctly blocked');

  // Create client B
  const nameB = `smoke-delete-b-${Date.now()}`;
  const createB = await request(`/api/pro/businesses/${businessId}/clients`, {
    method: 'POST',
    body: { name: nameB },
  });
  if (!createB.res.ok) throw new Error(`Create client B failed ${createB.res.status}`);
  const clientB = (createB.json as { id?: string })?.id;
  if (!clientB) throw new Error('No clientB id');

  // Archive B
  const archiveB = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientB], action: 'ARCHIVE' },
  });
  if (!archiveB.res.ok) throw new Error(`Archive B failed ${archiveB.res.status}`);

  // Delete B
  const delB = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientB], action: 'DELETE' },
  });
  if (!delB.res.ok) throw new Error(`Delete B failed ${delB.res.status}`);
  const deletedCount = (delB.json as { deletedCount?: number }).deletedCount ?? 0;
  if (deletedCount < 1) throw new Error(`Expected deletedCount >=1, got ${deletedCount}`);
  const failedB = (delB.json as { failed?: Array<{ id: string; reason: string }> }).failed ?? [];
  if (failedB.length) throw new Error(`Unexpected failures on delete B: ${JSON.stringify(failedB)}`);
  console.log('Archive + delete archived client succeeded');

  console.log('smoke-clients-delete OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
