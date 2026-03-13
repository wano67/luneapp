/**
 * Smoke test — Personal budgets CRUD
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-personal-budgets.ts
 */

import { createRequester, loginPersonal, assertItemShape, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[personal-budgets] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // ── LIST ──
  const { json: listJson } = await request('/api/personal/budgets');
  const body = listJson as Record<string, unknown>;
  assert(Array.isArray(body.items), 'GET /budgets returns items[]');
  assert('monthExpenseCents' in body, 'GET /budgets returns monthExpenseCents');
  console.log(`  ✓ Liste budgets (${(body.items as unknown[]).length})`);

  // ── CREATE ──
  const { json: createJson } = await request('/api/personal/budgets', {
    method: 'POST',
    body: { name: '__smoke_budget__', limitCents: 100000, period: 'MONTHLY' },
  });
  const created = assertItemShape(createJson, 'POST /budgets');
  const budgetId = created.id as string;
  assert(budgetId, 'budget id returned');
  console.log(`  ✓ Budget créé (id=${budgetId})`);

  // ── UPDATE ──
  const { json: patchJson } = await request(`/api/personal/budgets/${budgetId}`, {
    method: 'PATCH',
    body: { name: '__smoke_budget_updated__', limitCents: 200000 },
  });
  const patched = assertItemShape(patchJson, 'PATCH /budgets/:id');
  assert(patched.id, 'PATCH returns budget');
  console.log('  ✓ Mise à jour budget');

  // ── DELETE ──
  const { res: delRes } = await request(`/api/personal/budgets/${budgetId}`, { method: 'DELETE' });
  assert(delRes.status === 204 || delRes.status === 200, `DELETE status=${delRes.status}`);
  console.log('  ✓ Suppression budget');

  console.log('[personal-budgets] OK\n');
}

main().catch((err) => {
  console.error('[personal-budgets] ÉCHEC :', err.message);
  process.exit(1);
});
