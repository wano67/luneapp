/**
 * Smoke test — Personal accounts CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-personal-accounts.ts
 */

import { createRequester, loginPersonal, assertListShape, assertItemShape, assertEqual, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[personal-accounts] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request('/api/personal/accounts');
  const items = assertListShape(listJson, 'GET /accounts');
  console.log(`  ✓ Liste comptes (${items.length})`);

  // ── CREATE ──
  const { json: createJson } = await request('/api/personal/accounts', {
    method: 'POST',
    body: { name: '__smoke_account__', type: 'CURRENT', initialCents: 0, currency: 'EUR' },
  });
  const created = assertItemShape(createJson, 'POST /accounts');
  const accountId = created.id as string;
  assert(accountId, 'account id returned');
  console.log(`  ✓ Compte créé (id=${accountId})`);

  // ── READ ──
  const { json: readJson } = await request(`/api/personal/accounts/${accountId}`);
  const readBody = readJson as Record<string, unknown>;
  assert(readBody.account, 'GET /accounts/:id returns account');
  const account = readBody.account as Record<string, unknown>;
  assertEqual(account.name as string, '__smoke_account__', 'name matches');
  console.log('  ✓ Lecture compte');

  // ── UPDATE ──
  const { json: patchJson } = await request(`/api/personal/accounts/${accountId}`, {
    method: 'PATCH',
    body: { name: '__smoke_account_updated__' },
  });
  const patched = patchJson as Record<string, unknown>;
  assert(patched.account, 'PATCH returns account');
  console.log('  ✓ Mise à jour compte');

  // ── DELETE ──
  const { res: delRes } = await request(`/api/personal/accounts/${accountId}`, { method: 'DELETE' });
  assert(delRes.status === 204 || delRes.status === 200, `DELETE status=${delRes.status}`);
  console.log('  ✓ Suppression compte');

  // ── Verify deleted ──
  const { res: gone } = await request(`/api/personal/accounts/${accountId}`, { allowError: true });
  assert(gone.status === 404, `After delete → 404 (got ${gone.status})`);
  console.log('  ✓ Vérification suppression (404)');

  console.log('[personal-accounts] OK\n');
}

main().catch((err) => {
  console.error('[personal-accounts] ÉCHEC :', err.message);
  process.exit(1);
});
