/**
 * Smoke test — Vault CRUD (password storage)
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-vault.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert, assertEqual } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[vault] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request(`${base}/vault`);
  const items = assertListShape(listJson, 'GET /vault');
  console.log(`  ✓ Liste vault (${items.length})`);

  // ── LIST summary ──
  const { json: summaryJson, res: summaryRes } = await request(`${base}/vault?scope=summary`, { allowError: true });
  if (summaryRes.ok) {
    const summaryBody = summaryJson as Record<string, unknown>;
    assert(Array.isArray(summaryBody.items), 'GET /vault?scope=summary returns items[]');
    console.log('  ✓ Vault summary');
  } else {
    console.log(`  ⊘ Vault summary → ${summaryRes.status} (skip)`);
  }

  // ── CREATE ──
  const { json: createJson } = await request(`${base}/vault`, {
    method: 'POST',
    body: {
      title: '__smoke_vault_entry__',
      password: 'SuperSecretPass123!',
      identifier: 'smoke-user',
      email: 'smoke@test.com',
      note: 'Test entry for smoke tests',
    },
  });
  const created = assertItemShape(createJson, 'POST /vault');
  const vaultId = created.id as string;
  assert(vaultId, 'vault item id returned');
  console.log(`  ✓ Vault entry créée (id=${vaultId})`);

  // ── READ (should reveal decrypted password) ──
  const { json: readJson } = await request(`${base}/vault/${vaultId}`);
  const readBody = readJson as Record<string, unknown>;
  const item = (readBody.item ?? readBody) as Record<string, unknown>;
  assertEqual(item.title as string, '__smoke_vault_entry__', 'title matches');
  assert(item.password === 'SuperSecretPass123!', 'Password decrypted correctly');
  console.log('  ✓ Vault entry lue (password décrypté)');

  // ── UPDATE ──
  const { res: patchRes } = await request(`${base}/vault/${vaultId}`, {
    method: 'PATCH',
    body: { title: '__smoke_vault_updated__', password: 'NewPass456!' },
  });
  assert(patchRes.ok, `PATCH vault status=${patchRes.status}`);
  console.log('  ✓ Vault entry mise à jour');

  // ── Verify updated password ──
  const { json: read2Json } = await request(`${base}/vault/${vaultId}`);
  const item2 = ((read2Json as Record<string, unknown>).item ?? read2Json) as Record<string, unknown>;
  assert(item2.password === 'NewPass456!', 'Updated password decrypted correctly');
  console.log('  ✓ Password mis à jour vérifié');

  // ── DELETE ──
  const { res: delRes } = await request(`${base}/vault/${vaultId}`, { method: 'DELETE' });
  assert(delRes.status === 204 || delRes.status === 200, `DELETE status=${delRes.status}`);
  console.log('  ✓ Vault entry supprimée');

  console.log('[vault] OK\n');
}

main().catch((err) => {
  console.error('[vault] ÉCHEC :', err.message);
  process.exit(1);
});
