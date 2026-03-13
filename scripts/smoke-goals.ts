/**
 * Smoke test — Business goals CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-goals.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[goals] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request(`${base}/goals`);
  const items = assertListShape(listJson, 'GET /goals');
  console.log(`  ✓ Liste objectifs (${items.length})`);

  // ── CREATE ──
  const { json: createJson } = await request(`${base}/goals`, {
    method: 'POST',
    body: {
      name: '__smoke_goal__',
      metric: 'CA_HT',
      targetCents: 10000000,
      year: new Date().getFullYear(),
    },
  });
  const created = assertItemShape(createJson, 'POST /goals');
  const goalId = created.id as string;
  assert(goalId, 'goal id returned');
  console.log(`  ✓ Objectif créé (id=${goalId})`);

  // ── UPDATE ──
  const { res: patchRes } = await request(`${base}/goals/${goalId}`, {
    method: 'PATCH',
    body: { name: '__smoke_goal_updated__', targetCents: 20000000 },
  });
  assert(patchRes.ok, `PATCH goal status=${patchRes.status}`);
  console.log('  ✓ Objectif mis à jour');

  // ── DELETE ──
  const { res: delRes } = await request(`${base}/goals/${goalId}`, { method: 'DELETE' });
  assert(delRes.status === 204 || delRes.status === 200, `DELETE status=${delRes.status}`);
  console.log('  ✓ Objectif supprimé');

  console.log('[goals] OK\n');
}

main().catch((err) => {
  console.error('[goals] ÉCHEC :', err.message);
  process.exit(1);
});
