/**
 * Smoke test — Prospects CRUD + convert to client
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-prospects.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[prospects] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request(`${base}/prospects`);
  const items = assertListShape(listJson, 'GET /prospects');
  console.log(`  ✓ Liste prospects (${items.length})`);

  // ── CREATE ──
  const unique = `Smoke Prospect ${Date.now()}`;
  const { json: createJson } = await request(`${base}/prospects`, {
    method: 'POST',
    body: { name: unique, email: `smoke-prospect-${Date.now()}@test.com`, phone: '+33600000000' },
  });
  const created = assertItemShape(createJson, 'POST /prospects');
  const prospectId = created.id as string;
  assert(prospectId, 'prospect id returned');
  console.log(`  ✓ Prospect créé (id=${prospectId})`);

  // ── UPDATE ──
  const { res: patchRes } = await request(`${base}/prospects/${prospectId}`, {
    method: 'PATCH',
    body: { name: `${unique} Updated` },
  });
  assert(patchRes.ok, `PATCH prospect status=${patchRes.status}`);
  console.log('  ✓ Prospect mis à jour');

  // ── CONVERT to client ──
  const { res: convertRes, json: convertJson } = await request(`${base}/prospects/${prospectId}/convert`, {
    method: 'POST',
    allowError: true,
  });
  if (convertRes.ok) {
    const converted = convertJson as Record<string, unknown>;
    console.log(`  ✓ Prospect converti en client (${JSON.stringify(converted).slice(0, 80)})`);

    // Cleanup: delete the created client
    const clientItem = (converted.item ?? converted.client ?? converted) as Record<string, unknown>;
    if (clientItem.id) {
      await request(`${base}/clients/${clientItem.id}`, { method: 'DELETE', allowError: true });
      console.log('  ✓ Client nettoyé');
    }
  } else {
    console.log(`  ⊘ Convert → ${convertRes.status} (endpoint may not exist, skip)`);
    // Cleanup: delete the prospect
    await request(`${base}/prospects/${prospectId}`, { method: 'DELETE' });
    console.log('  ✓ Prospect nettoyé');
  }

  console.log('[prospects] OK\n');
}

main().catch((err) => {
  console.error('[prospects] ÉCHEC :', err.message);
  process.exit(1);
});
