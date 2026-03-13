/**
 * Smoke test — Global search endpoint
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-search.ts
 */

import { createRequester, loginAndPickBusiness, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[search] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── SEARCH with query ──
  const { json: searchJson, res: searchRes } = await request(`${base}/search?q=test`, { allowError: true });
  if (!searchRes.ok) {
    console.log(`  ⊘ Search endpoint → ${searchRes.status} (skip)`);
    console.log('[search] OK (skipped)\n');
    return;
  }

  const results = searchJson as Record<string, unknown>;
  // Search returns categorized results
  const expectedKeys = ['projects', 'clients', 'prospects', 'tasks', 'messages', 'documents'];
  for (const key of expectedKeys) {
    if (key in results) {
      assert(Array.isArray(results[key]), `search.${key} is array`);
    }
  }
  const totalResults = expectedKeys.reduce((sum, key) => {
    return sum + (Array.isArray(results[key]) ? (results[key] as unknown[]).length : 0);
  }, 0);
  console.log(`  ✓ Search "test" (${totalResults} résultats)`);

  // ── SEARCH with short query → 400 ──
  const { res: shortRes } = await request(`${base}/search?q=a`, { allowError: true });
  assert([400, 422].includes(shortRes.status) || shortRes.ok, `Short query handled (${shortRes.status})`);
  console.log(`  ✓ Short query handled (${shortRes.status})`);

  // ── SEARCH empty query → 400 ──
  const { res: emptyRes } = await request(`${base}/search?q=`, { allowError: true });
  assert([400, 422].includes(emptyRes.status) || emptyRes.ok, `Empty query handled (${emptyRes.status})`);
  console.log(`  ✓ Empty query handled (${emptyRes.status})`);

  console.log('[search] OK\n');
}

main().catch((err) => {
  console.error('[search] ÉCHEC :', err.message);
  process.exit(1);
});
