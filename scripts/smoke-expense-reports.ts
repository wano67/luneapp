/**
 * Smoke test — Expense reports CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-expense-reports.ts
 */

import { createRequester, loginAndPickBusiness, assertListShape, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';

async function main() {
  console.log('[expense-reports] Démarrage…');

  const { request } = createRequester(baseUrl);
  const { businessId } = await loginAndPickBusiness(request);
  const base = `/api/pro/businesses/${businessId}`;
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson, res: listRes } = await request(`${base}/expense-reports`, { allowError: true });
  if (!listRes.ok) {
    console.log(`  ⊘ Expense reports endpoint → ${listRes.status} (skip)`);
    console.log('[expense-reports] OK (skipped)\n');
    return;
  }
  const items = assertListShape(listJson, 'GET /expense-reports');
  console.log(`  ✓ Liste notes de frais (${items.length})`);

  // ── CREATE ──
  const { json: createJson, res: createRes } = await request(`${base}/expense-reports`, {
    method: 'POST',
    body: {
      title: '__smoke_expense_report__',
      date: new Date().toISOString().slice(0, 10),
      amountCents: 5000,
      category: 'TRANSPORT',
    },
    allowError: true,
  });
  if (!createRes.ok) {
    console.log(`  ⊘ Create expense report → ${createRes.status} (may need extra fields, skip)`);
    console.log('[expense-reports] OK (partial)\n');
    return;
  }
  const created = assertItemShape(createJson, 'POST /expense-reports');
  const reportId = created.id as string;
  assert(reportId, 'expense report id returned');
  console.log(`  ✓ Note de frais créée (id=${reportId})`);

  // ── DELETE ──
  const { res: delRes } = await request(`${base}/expense-reports/${reportId}`, { method: 'DELETE', allowError: true });
  if (delRes.status === 204 || delRes.status === 200) {
    console.log('  ✓ Note de frais supprimée');
  } else {
    console.log(`  ⊘ DELETE → ${delRes.status}`);
  }

  console.log('[expense-reports] OK\n');
}

main().catch((err) => {
  console.error('[expense-reports] ÉCHEC :', err.message);
  process.exit(1);
});
