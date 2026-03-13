/**
 * Smoke test — Personal subscriptions CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-personal-subscriptions.ts
 */

import { createRequester, loginPersonal, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[personal-subscriptions] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request('/api/personal/subscriptions');
  const items = assertListShape(listJson, 'GET /subscriptions');
  console.log(`  ✓ Liste abonnements (${items.length})`);

  // ── CREATE ──
  const { json: createJson } = await request('/api/personal/subscriptions', {
    method: 'POST',
    body: {
      name: '__smoke_sub__',
      amountCents: 999,
      frequency: 'MONTHLY',
      startDate: '2025-01-01',
    },
  });
  const created = assertItemShape(createJson, 'POST /subscriptions');
  const subId = created.id as string;
  assert(subId, 'subscription id returned');
  console.log(`  ✓ Abonnement créé (id=${subId})`);

  // ── UPDATE ──
  const { json: patchJson } = await request(`/api/personal/subscriptions/${subId}`, {
    method: 'PATCH',
    body: { name: '__smoke_sub_updated__', amountCents: 1499 },
  });
  const patched = assertItemShape(patchJson, 'PATCH /subscriptions/:id');
  assert(patched.id, 'PATCH returns subscription');
  console.log('  ✓ Mise à jour abonnement');

  // ── DELETE ──
  const { res: delRes } = await request(`/api/personal/subscriptions/${subId}`, { method: 'DELETE' });
  assert(delRes.status === 204 || delRes.status === 200, `DELETE status=${delRes.status}`);
  console.log('  ✓ Suppression abonnement');

  console.log('[personal-subscriptions] OK\n');
}

main().catch((err) => {
  console.error('[personal-subscriptions] ÉCHEC :', err.message);
  process.exit(1);
});
