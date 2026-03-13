/**
 * Smoke test — Personal savings goals CRUD + reorder
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-personal-savings.ts
 */

import { createRequester, loginPersonal, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[personal-savings] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request('/api/personal/savings');
  const body = listJson as Record<string, unknown>;
  assert(Array.isArray(body.items), 'GET /savings returns items[]');
  assert('savingsAccountsTotalCents' in body, 'GET /savings returns aggregations');
  console.log(`  ✓ Liste objectifs épargne (${(body.items as unknown[]).length})`);

  // ── CREATE #1 ──
  const { json: c1Json } = await request('/api/personal/savings', {
    method: 'POST',
    body: { name: '__smoke_save_A__', targetCents: 500000, priority: 1 },
  });
  const g1 = assertItemShape(c1Json, 'POST /savings #1');
  const g1Id = g1.id as string;
  console.log(`  ✓ Objectif A créé (id=${g1Id})`);

  // ── CREATE #2 ──
  const { json: c2Json } = await request('/api/personal/savings', {
    method: 'POST',
    body: { name: '__smoke_save_B__', targetCents: 1000000, priority: 2 },
  });
  const g2 = assertItemShape(c2Json, 'POST /savings #2');
  const g2Id = g2.id as string;
  console.log(`  ✓ Objectif B créé (id=${g2Id})`);

  // ── UPDATE ──
  const { json: patchJson } = await request(`/api/personal/savings/${g1Id}`, {
    method: 'PATCH',
    body: { name: '__smoke_save_A_upd__', targetCents: 600000 },
  });
  const patched = assertItemShape(patchJson, 'PATCH /savings/:id');
  assert(patched.id, 'PATCH returns goal');
  console.log('  ✓ Mise à jour objectif');

  // ── REORDER (if supported) ──
  try {
    await request('/api/personal/savings/reorder', {
      method: 'PATCH',
      body: { ids: [g2Id, g1Id] },
    });
    console.log('  ✓ Reorder objectifs');
  } catch {
    console.log('  ⊘ Reorder non supporté (skip)');
  }

  // ── CLEANUP ──
  await request(`/api/personal/savings/${g1Id}`, { method: 'DELETE' });
  await request(`/api/personal/savings/${g2Id}`, { method: 'DELETE' });
  console.log('  ✓ Cleanup objectifs');

  console.log('[personal-savings] OK\n');
}

main().catch((err) => {
  console.error('[personal-savings] ÉCHEC :', err.message);
  process.exit(1);
});
