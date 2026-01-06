/**
 * Smoke test GDPR: archive + delete only when archived; anonymize archived clients.
 *
 * Steps:
 * - login admin
 * - create client A, attempt delete (should fail: must be archived)
 * - archive A then delete -> success
 * - create client B, archive, anonymize -> success, fields nulled
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

async function getBusinessId() {
  const { res, json } = await request('/api/pro/businesses');
  if (!res.ok) throw new Error(`Businesses failed ${res.status}`);
  return (json as { items?: Array<{ business?: { id?: string } }> })?.items?.[0]?.business?.id;
}

async function createClient(businessId: string, name: string) {
  const { res, json } = await request(`/api/pro/businesses/${businessId}/clients`, {
    method: 'POST',
    body: { name },
  });
  if (!res.ok) throw new Error(`Create client failed ${res.status}`);
  return (json as { id?: string })?.id;
}

async function main() {
  console.log(`Base URL: ${baseUrl}`);
  const logged = await login();
  if (!logged) return;

  const businessId = await getBusinessId();
  if (!businessId) throw new Error('No business found');

  // Client A: delete requires archive
  const clientA = await createClient(businessId, `smoke-gdpr-a-${Date.now()}`);
  if (!clientA) throw new Error('No clientA id');
  const delA = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientA], action: 'DELETE' },
  });
  if (!delA.res.ok) throw new Error(`Delete A failed ${delA.res.status}`);
  const failedA = (delA.json as { failed?: Array<{ id: string; reason: string }> }).failed ?? [];
  if (!failedA.some((f) => f.id === clientA)) {
    throw new Error('Expected delete A to be blocked for non-archived client');
  }
  console.log('Delete non-archived blocked');

  const archiveA = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientA], action: 'ARCHIVE' },
  });
  if (!archiveA.res.ok) throw new Error(`Archive A failed ${archiveA.res.status}`);
  const deleteArchived = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientA], action: 'DELETE' },
  });
  if (!deleteArchived.res.ok) throw new Error(`Delete archived failed ${deleteArchived.res.status}`);
  const deletedCount = (deleteArchived.json as { deletedCount?: number }).deletedCount ?? 0;
  if (deletedCount < 1) throw new Error('Archived delete did not delete');
  console.log('Archived delete succeeded');

  // Client B: anonymize
  const clientB = await createClient(businessId, `smoke-gdpr-b-${Date.now()}`);
  if (!clientB) throw new Error('No clientB id');
  const archiveB = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientB], action: 'ARCHIVE' },
  });
  if (!archiveB.res.ok) throw new Error(`Archive B failed ${archiveB.res.status}`);
  const anon = await request(`/api/pro/businesses/${businessId}/clients/bulk`, {
    method: 'POST',
    body: { clientIds: [clientB], action: 'ANONYMIZE', reason: 'smoke test' },
  });
  if (!anon.res.ok) throw new Error(`Anonymize failed ${anon.res.status}`);
  const list = await request(`/api/pro/businesses/${businessId}/clients?archived=1`);
  if (!list.res.ok) throw new Error(`List after anonymize failed ${list.res.status}`);
  const item = (list.json as { items?: Array<{ id?: string; email?: string | null; phone?: string | null; websiteUrl?: string | null; anonymizedAt?: string | null }> }).items?.find((c) => c.id === clientB);
  if (!item || item.email || item.phone || item.websiteUrl || !item.anonymizedAt) {
    throw new Error('Anonymized fields not cleared');
  }
  console.log('Anonymization succeeded');

  console.log('smoke-clients-gdpr OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
