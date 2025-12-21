/**
 * Smoke test: finance advanced endpoints (treasury, vat, forecasting).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm smoke:finance-advanced
 * Fallback: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* absent.
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

  console.log('Treasury…');
  const { res: treasuryRes, json: treasuryJson } = await request(
    `/api/pro/businesses/${businessId}/finances/treasury`
  );
  if (!treasuryRes.ok) throw new Error(`Treasury failed (${treasuryRes.status}) ref=${getLastRequestId()}`);
  const monthly = (treasuryJson as { monthly?: Array<unknown> })?.monthly ?? [];
  if (!Array.isArray(monthly) || monthly.length === 0) {
    throw new Error('Treasury monthly empty or invalid');
  }

  console.log('VAT…');
  const { res: vatRes } = await request(`/api/pro/businesses/${businessId}/finances/vat`);
  if (!vatRes.ok) throw new Error(`VAT failed (${vatRes.status}) ref=${getLastRequestId()}`);

  console.log('Forecasting…');
  const { res: forecastRes, json: forecastJson } = await request(
    `/api/pro/businesses/${businessId}/finances/forecasting`
  );
  if (!forecastRes.ok) throw new Error(`Forecasting failed (${forecastRes.status}) ref=${getLastRequestId()}`);
  const history = (forecastJson as { history?: Array<unknown> })?.history ?? [];
  const projections = (forecastJson as { projections?: Array<unknown> })?.projections ?? [];
  if (!Array.isArray(history) || !Array.isArray(projections)) {
    throw new Error('Forecast payload invalid');
  }

  console.log('Smoke finance advanced OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
