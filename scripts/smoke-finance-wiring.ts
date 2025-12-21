/**
 * Smoke test: Finance wiring (payments -> dashboard).
 *
 * Usage:
 *   BASE_URL=http://localhost:3000 TEST_EMAIL=... TEST_PASSWORD=... pnpm tsx scripts/smoke-finance-wiring.ts
 * Fallback envs: ADMIN_EMAIL/ADMIN_PASSWORD if TEST_* absent.
 *
 * Steps:
 *  - Login
 *  - Pick first business
 *  - GET dashboard (capture MTD income/net)
 *  - POST finance INCOME (category=PAYMENT)
 *  - GET dashboard again and assert MTD income increased
 *  - Cleanup: DELETE finance created
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

  console.log(`Business ${businessId}`);

  console.log('Dashboard before…');
  const { res: dashBeforeRes, json: dashBefore } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashBeforeRes.ok) throw new Error(`Dashboard failed (${dashBeforeRes.status}) ref=${getLastRequestId()}`);
  const beforeIncome = BigInt(
    (dashBefore as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  console.log('Create finance (payment)…');
  const amount = 123.45;
  const today = new Date().toISOString();
  const { res: createRes, json: createJson } = await request(
    `/api/pro/businesses/${businessId}/finances`,
    {
      method: 'POST',
      body: {
        type: 'INCOME',
        amount,
        category: 'PAYMENT',
        date: today,
        metadata: {
          clientName: 'Smoke Client',
          status: 'PAID',
          method: 'VIREMENT',
          receivedAt: today,
          expectedAt: today,
          currency: 'EUR',
        },
      },
    }
  );
  if (!createRes.ok) throw new Error(`Create finance failed (${createRes.status}) ref=${getLastRequestId()}`);
  const financeId = (createJson as { item?: { id?: string } })?.item?.id;

  console.log('Dashboard after…');
  const { res: dashAfterRes, json: dashAfter } = await request(
    `/api/pro/businesses/${businessId}/dashboard`
  );
  if (!dashAfterRes.ok) throw new Error(`Dashboard failed (${dashAfterRes.status}) ref=${getLastRequestId()}`);
  const afterIncome = BigInt(
    (dashAfter as { kpis?: { mtdIncomeCents?: string } })?.kpis?.mtdIncomeCents ?? '0'
  );

  if (afterIncome <= beforeIncome) {
    throw new Error(
      `MTD income did not increase (before ${beforeIncome}, after ${afterIncome}) ref=${lastRequestId}`
    );
  }
  console.log('Income increased as expected.');

  if (financeId) {
    console.log('Cleanup…');
    const { res: delRes } = await request(
      `/api/pro/businesses/${businessId}/finances/${financeId}`,
      { method: 'DELETE' }
    );
    if (!delRes.ok) {
      console.warn(`Cleanup failed (${delRes.status}) ref=${getLastRequestId()}`);
    }
  }

  console.log('Smoke finance wiring OK.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
