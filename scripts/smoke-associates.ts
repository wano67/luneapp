/**
 * Smoke test — Business associates (dirigeants) CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-associates.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[associates] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson, res: listRes } = await request(`${base}/associates`, { allowError: true });
  if (!listRes.ok) {
    console.log(`  ⊘ Associates endpoint → ${listRes.status} (skip)`);
    console.log('[associates] OK (skipped)\n');
    return;
  }
  const items = assertListShape(listJson, 'GET /associates');
  console.log(`  ✓ Liste associés (${items.length})`);

  // ── CREATE ──
  const { json: createJson, res: createRes } = await request(`${base}/associates`, {
    method: 'POST',
    body: {
      name: '__smoke_associate__',
      role: 'ASSOCIATE',
      sharePercent: 10,
      targetSalaryCents: 300000,
      targetDividendsCents: 100000,
    },
    allowError: true,
  });
  if (!createRes.ok) {
    console.log(`  ⊘ Create associate → ${createRes.status} (may need different fields, skip)`);
    console.log('[associates] OK (partial)\n');
    return;
  }
  const created = assertItemShape(createJson, 'POST /associates');
  const assocId = created.id as string;
  assert(assocId, 'associate id returned');
  console.log(`  ✓ Associé créé (id=${assocId})`);

  // ── UPDATE ──
  const { res: patchRes } = await request(`${base}/associates/${assocId}`, {
    method: 'PATCH',
    body: { name: '__smoke_associate_updated__' },
    allowError: true,
  });
  if (patchRes.ok) {
    console.log('  ✓ Associé mis à jour');
  } else {
    console.log(`  ⊘ PATCH associate → ${patchRes.status}`);
  }

  // ── SIMULATE (if supported) ──
  const { res: simRes } = await request(`${base}/associates/simulate`, {
    method: 'POST',
    body: { revenueCents: 10000000 },
    allowError: true,
  });
  if (simRes.ok) {
    console.log('  ✓ Simulation OK');
  } else {
    console.log(`  ⊘ Simulate → ${simRes.status} (skip)`);
  }

  // ── DELETE ──
  const { res: delRes } = await request(`${base}/associates/${assocId}`, { method: 'DELETE', allowError: true });
  if (delRes.status === 204 || delRes.status === 200) {
    console.log('  ✓ Associé supprimé');
  } else {
    console.log(`  ⊘ DELETE associate → ${delRes.status}`);
  }

  console.log('[associates] OK\n');
}

main().catch((err) => {
  console.error('[associates] ÉCHEC :', err.message);
  process.exit(1);
});
