/**
 * Smoke test — Personal categories CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-personal-categories.ts
 */

import { createRequester, loginPersonal, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[personal-categories] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request('/api/personal/categories');
  const items = assertListShape(listJson, 'GET /categories');
  console.log(`  ✓ Liste catégories (${items.length})`);

  // ── CREATE ──
  const unique = `__smoke_cat_${Date.now()}__`;
  const { json: createJson } = await request('/api/personal/categories', {
    method: 'POST',
    body: { name: unique, icon: 'tag', color: '#FF5733' },
  });
  const created = assertItemShape(createJson, 'POST /categories');
  const catId = created.id as string;
  assert(catId, 'category id returned');
  console.log(`  ✓ Catégorie créée (id=${catId})`);

  // ── UPDATE ──
  const { json: patchJson } = await request(`/api/personal/categories/${catId}`, {
    method: 'PATCH',
    body: { name: `${unique}_upd` },
  });
  const patched = assertItemShape(patchJson, 'PATCH /categories/:id');
  assert(patched.id, 'PATCH returns category');
  console.log('  ✓ Mise à jour catégorie');

  // ── DELETE ──
  const { res: delRes } = await request(`/api/personal/categories/${catId}`, { method: 'DELETE' });
  assert(delRes.status === 204 || delRes.status === 200, `DELETE status=${delRes.status}`);
  console.log('  ✓ Suppression catégorie');

  console.log('[personal-categories] OK\n');
}

main().catch((err) => {
  console.error('[personal-categories] ÉCHEC :', err.message);
  process.exit(1);
});
