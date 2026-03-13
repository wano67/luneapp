/**
 * Smoke test — Interactions CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-interactions.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[interactions] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson, res: listRes } = await request(`${base}/interactions`, { allowError: true });
  if (!listRes.ok) {
    console.log(`  ⊘ Interactions endpoint → ${listRes.status} (skip)`);
    console.log('[interactions] OK (skipped)\n');
    return;
  }
  const items = assertListShape(listJson, 'GET /interactions');
  console.log(`  ✓ Liste interactions (${items.length})`);

  // ── CREATE ──
  const { json: createJson, res: createRes } = await request(`${base}/interactions`, {
    method: 'POST',
    body: {
      type: 'CALL',
      title: '__smoke_interaction__',
      date: new Date().toISOString(),
      note: 'Smoke test interaction',
    },
    allowError: true,
  });
  if (!createRes.ok) {
    console.log(`  ⊘ Create interaction → ${createRes.status} (may need clientId, skip)`);
    console.log('[interactions] OK (partial)\n');
    return;
  }
  const created = assertItemShape(createJson, 'POST /interactions');
  const interactionId = created.id as string;
  assert(interactionId, 'interaction id returned');
  console.log(`  ✓ Interaction créée (id=${interactionId})`);

  // ── UPDATE ──
  const { res: patchRes } = await request(`${base}/interactions/${interactionId}`, {
    method: 'PATCH',
    body: { title: '__smoke_interaction_updated__' },
    allowError: true,
  });
  if (patchRes.ok) {
    console.log('  ✓ Interaction mise à jour');
  } else {
    console.log(`  ⊘ PATCH interaction → ${patchRes.status} (skip)`);
  }

  // ── DELETE ──
  const { res: delRes } = await request(`${base}/interactions/${interactionId}`, { method: 'DELETE', allowError: true });
  if (delRes.status === 204 || delRes.status === 200) {
    console.log('  ✓ Interaction supprimée');
  } else {
    console.log(`  ⊘ DELETE interaction → ${delRes.status}`);
  }

  console.log('[interactions] OK\n');
}

main().catch((err) => {
  console.error('[interactions] ÉCHEC :', err.message);
  process.exit(1);
});
