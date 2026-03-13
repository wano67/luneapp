/**
 * Smoke test — Data isolation: cross-user and cross-business access denied
 *
 * Requires both ADMIN and TEST credentials.
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-data-isolation.ts
 */

import { createRequester, getSmokeCreds, assert, handleMissingCreds } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[data-isolation] Démarrage…');

  // Need both admin and test creds
  let adminCreds, testCreds;
  try {
    adminCreds = getSmokeCreds({ preferAdmin: true });
    testCreds = getSmokeCreds({ preferAdmin: false });
  } catch {
    handleMissingCreds('data-isolation requires both ADMIN and TEST credentials. Skipping.');
    return;
  }

  if (adminCreds.email === testCreds.email) {
    handleMissingCreds('data-isolation requires TWO DIFFERENT accounts (ADMIN_EMAIL ≠ TEST_EMAIL). Skipping.');
    return;
  }

  // ── Login as Admin ──
  const { request: adminReq } = createRequester(baseUrl);
  await adminReq('/api/auth/login', {
    method: 'POST',
    body: { email: adminCreds.email, password: adminCreds.password },
  });
  console.log('  ✓ Admin logged in');

  // Get admin's businesses
  const { json: adminBizJson } = await adminReq('/api/pro/businesses');
  const adminBiz = ((adminBizJson as Record<string, unknown>).items as Array<Record<string, unknown>>)?.[0];
  const adminBizId = (adminBiz?.business as Record<string, unknown>)?.id as string;
  assert(adminBizId, 'Admin has a business');
  console.log(`  ✓ Admin business: ${adminBizId}`);

  // Get admin's personal data
  const { json: adminAccJson } = await adminReq('/api/personal/accounts');
  const adminAccounts = (adminAccJson as Record<string, unknown>).items as unknown[];
  console.log(`  ✓ Admin has ${adminAccounts.length} personal accounts`);

  // ── Login as Test user ──
  const { request: testReq } = createRequester(baseUrl);
  await testReq('/api/auth/login', {
    method: 'POST',
    body: { email: testCreds.email, password: testCreds.password },
  });
  console.log('  ✓ Test user logged in');

  // ── Cross-business access ──
  // Test user should NOT be able to access admin's business routes
  const { res: crossBizRes } = await testReq(
    `/api/pro/businesses/${adminBizId}/clients`,
    { allowError: true },
  );
  assert(
    [401, 403, 404].includes(crossBizRes.status),
    `Cross-business access denied (got ${crossBizRes.status})`,
  );
  console.log(`  ✓ Cross-business GET /clients blocked (${crossBizRes.status})`);

  const { res: crossBizFinRes } = await testReq(
    `/api/pro/businesses/${adminBizId}/finances`,
    { allowError: true },
  );
  assert(
    [401, 403, 404].includes(crossBizFinRes.status),
    `Cross-business finances denied (got ${crossBizFinRes.status})`,
  );
  console.log(`  ✓ Cross-business GET /finances blocked (${crossBizFinRes.status})`);

  // ── Cross-business mutation ──
  const { res: crossBizMutRes } = await testReq(
    `/api/pro/businesses/${adminBizId}/clients`,
    {
      method: 'POST',
      body: { name: 'HACK ATTEMPT' },
      allowError: true,
    },
  );
  assert(
    [401, 403, 404].includes(crossBizMutRes.status),
    `Cross-business POST /clients blocked (got ${crossBizMutRes.status})`,
  );
  console.log(`  ✓ Cross-business POST /clients blocked (${crossBizMutRes.status})`);

  // ── Personal data isolation ──
  // If admin has personal accounts, test user should not see them
  if (adminAccounts.length > 0) {
    const adminAccId = (adminAccounts[0] as Record<string, unknown>).id as string;
    const { res: crossPersonalRes } = await testReq(
      `/api/personal/accounts/${adminAccId}`,
      { allowError: true },
    );
    assert(
      [401, 403, 404].includes(crossPersonalRes.status),
      `Personal account isolation (got ${crossPersonalRes.status})`,
    );
    console.log(`  ✓ Personal account isolation (${crossPersonalRes.status})`);
  }

  // ── Unauthenticated access ──
  const { request: anonReq } = createRequester(baseUrl);
  const { res: anonRes } = await anonReq('/api/personal/accounts', { allowError: true });
  assert(
    [401, 403].includes(anonRes.status),
    `Unauthenticated personal access denied (got ${anonRes.status})`,
  );
  console.log(`  ✓ Unauthenticated access blocked (${anonRes.status})`);

  const { res: anonBizRes } = await anonReq(`/api/pro/businesses/${adminBizId}/clients`, { allowError: true });
  assert(
    [401, 403].includes(anonBizRes.status),
    `Unauthenticated business access denied (got ${anonBizRes.status})`,
  );
  console.log(`  ✓ Unauthenticated business access blocked (${anonBizRes.status})`);

  console.log('[data-isolation] OK\n');
}

main().catch((err) => {
  console.error('[data-isolation] ÉCHEC :', err.message);
  process.exit(1);
});
