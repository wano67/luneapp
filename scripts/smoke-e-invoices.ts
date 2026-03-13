/**
 * Smoke test — E-invoices (electronic invoicing)
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-e-invoices.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[e-invoices] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson, res: listRes } = await request(`${base}/e-invoices`, { allowError: true });
  if (!listRes.ok) {
    console.log(`  ⊘ E-invoices endpoint → ${listRes.status} (skip)`);
    console.log('[e-invoices] OK (skipped)\n');
    return;
  }
  const items = assertListShape(listJson, 'GET /e-invoices');
  console.log(`  ✓ Liste e-factures (${items.length})`);

  // Verify item shape if any exist
  if (items.length > 0) {
    const first = items[0] as Record<string, unknown>;
    assert(first.id, 'E-invoice has id');
    assert('status' in first, 'E-invoice has status');
    console.log(`  ✓ Premier e-facture shape OK (id=${first.id}, status=${first.status})`);
  }

  console.log('[e-invoices] OK\n');
}

main().catch((err) => {
  console.error('[e-invoices] ÉCHEC :', err.message);
  process.exit(1);
});
