/**
 * Smoke test: business settings.
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:settings
 * Fallback: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* are absent.
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

  console.log('GET settings…');
  const { res: getRes, json: getJson } = await request(
    `/api/pro/businesses/${businessId}/settings`
  );
  if (!getRes.ok) throw new Error(`GET settings failed (${getRes.status}) ref=${getLastRequestId()}`);
  const currentTerms =
    (getJson as { item?: { paymentTermsDays?: number } })?.item?.paymentTermsDays ?? 0;

  console.log('PATCH settings…');
  const nextTerms = currentTerms + 1;
  const { res: patchRes } = await request(`/api/pro/businesses/${businessId}/settings`, {
    method: 'PATCH',
    body: { paymentTermsDays: nextTerms },
  });
  if (!patchRes.ok) throw new Error(`PATCH settings failed (${patchRes.status}) ref=${getLastRequestId()}`);

  console.log('GET settings again…');
  const { res: finalRes, json: finalJson } = await request(
    `/api/pro/businesses/${businessId}/settings`
  );
  if (!finalRes.ok) throw new Error(`Final GET failed (${finalRes.status}) ref=${getLastRequestId()}`);
  const finalTerms =
    (finalJson as { item?: { paymentTermsDays?: number } })?.item?.paymentTermsDays ?? 0;
  if (finalTerms !== nextTerms) {
    throw new Error(`paymentTermsDays not updated (expected ${nextTerms}, got ${finalTerms}) ref=${lastRequestId}`);
  }

  console.log('Smoke settings OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
