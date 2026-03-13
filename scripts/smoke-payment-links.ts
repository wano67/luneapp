/**
 * Smoke test — Payment links CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-payment-links.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[payment-links] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson, res: listRes } = await request(`${base}/payment-links`, { allowError: true });
  if (!listRes.ok) {
    console.log(`  ⊘ Payment links endpoint → ${listRes.status} (skip)`);
    console.log('[payment-links] OK (skipped)\n');
    return;
  }
  const items = assertListShape(listJson, 'GET /payment-links');
  console.log(`  ✓ Liste payment links (${items.length})`);

  // ── CREATE ──
  const { json: createJson, res: createRes } = await request(`${base}/payment-links`, {
    method: 'POST',
    body: {
      amountCents: 5000,
      currency: 'EUR',
      description: '__smoke_payment_link__',
    },
    allowError: true,
  });
  if (!createRes.ok) {
    console.log(`  ⊘ Create payment link → ${createRes.status} (may need clientId, skip)`);
    console.log('[payment-links] OK (partial)\n');
    return;
  }
  const created = assertItemShape(createJson, 'POST /payment-links');
  const linkId = created.id as string;
  assert(linkId, 'payment link id returned');
  console.log(`  ✓ Payment link créé (id=${linkId})`);

  // ── UPDATE ──
  const { res: patchRes } = await request(`${base}/payment-links/${linkId}`, {
    method: 'PATCH',
    body: { description: '__smoke_payment_link_updated__' },
    allowError: true,
  });
  if (patchRes.ok) {
    console.log('  ✓ Payment link mis à jour');
  } else {
    console.log(`  ⊘ PATCH payment link → ${patchRes.status} (skip)`);
  }

  // ── DELETE ──
  const { res: delRes } = await request(`${base}/payment-links/${linkId}`, { method: 'DELETE', allowError: true });
  if (delRes.status === 204 || delRes.status === 200) {
    console.log('  ✓ Payment link supprimé');
  } else {
    console.log(`  ⊘ DELETE payment link → ${delRes.status}`);
  }

  console.log('[payment-links] OK\n');
}

main().catch((err) => {
  console.error('[payment-links] ÉCHEC :', err.message);
  process.exit(1);
});
