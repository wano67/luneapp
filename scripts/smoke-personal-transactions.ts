/**
 * Smoke test — Personal transactions CRUD + analytics
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-personal-transactions.ts
 */

import { createRequester, loginPersonal, assertListShape, assertItemShape, assertEqual, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[personal-transactions] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // Ensure we have an account to work with
  const { json: accListJson } = await request('/api/personal/accounts');
  const accounts = assertListShape(accListJson, 'GET /accounts');

  let accountId: string;
  let createdAccount = false;

  if (accounts.length > 0) {
    accountId = (accounts[0] as Record<string, unknown>).id as string;
  } else {
    const { json: createAccJson } = await request('/api/personal/accounts', {
      method: 'POST',
      body: { name: '__smoke_tx_account__', type: 'CURRENT', initialCents: 0 },
    });
    const acc = assertItemShape(createAccJson, 'POST /accounts');
    accountId = acc.id as string;
    createdAccount = true;
  }
  console.log(`  ✓ Account prêt (id=${accountId})`);

  // ── LIST ──
  const { json: listJson } = await request('/api/personal/transactions');
  const body = listJson as Record<string, unknown>;
  assert(Array.isArray(body.items), 'GET /transactions returns items[]');
  console.log(`  ✓ Liste transactions (${(body.items as unknown[]).length})`);

  // ── CREATE INCOME ──
  const { json: incJson } = await request('/api/personal/transactions', {
    method: 'POST',
    body: {
      accountId,
      type: 'INCOME',
      date: new Date().toISOString().slice(0, 10),
      amountCents: 50000,
      label: '__smoke_income__',
    },
  });
  const income = assertItemShape(incJson, 'POST /transactions INCOME');
  const incomeId = income.id as string;
  assert(incomeId, 'income id returned');
  console.log(`  ✓ Transaction INCOME créée (id=${incomeId})`);

  // ── CREATE EXPENSE ──
  const { json: expJson } = await request('/api/personal/transactions', {
    method: 'POST',
    body: {
      accountId,
      type: 'EXPENSE',
      date: new Date().toISOString().slice(0, 10),
      amountCents: 2000,
      label: '__smoke_expense__',
    },
  });
  const expense = assertItemShape(expJson, 'POST /transactions EXPENSE');
  const expenseId = expense.id as string;
  console.log(`  ✓ Transaction EXPENSE créée (id=${expenseId})`);

  // ── UPDATE ──
  const { json: patchJson } = await request(`/api/personal/transactions/${incomeId}`, {
    method: 'PATCH',
    body: { label: '__smoke_income_updated__' },
  });
  const patched = assertItemShape(patchJson, 'PATCH /transactions/:id');
  assertEqual(patched.label as string, '__smoke_income_updated__', 'label updated');
  console.log('  ✓ Mise à jour transaction');

  // ── ANALYTICS ──
  const { json: analyticsJson } = await request('/api/personal/analytics');
  const analytics = analyticsJson as Record<string, unknown>;
  assert('totalBalanceCents' in analytics || 'monthIncomeCents' in analytics, 'Analytics returns KPIs');
  console.log('  ✓ Analytics');

  // ── CLEANUP ──
  await request(`/api/personal/transactions/${incomeId}`, { method: 'DELETE' });
  await request(`/api/personal/transactions/${expenseId}`, { method: 'DELETE' });
  console.log('  ✓ Cleanup transactions');

  if (createdAccount) {
    await request(`/api/personal/accounts/${accountId}`, { method: 'DELETE' });
    console.log('  ✓ Cleanup account');
  }

  console.log('[personal-transactions] OK\n');
}

main().catch((err) => {
  console.error('[personal-transactions] ÉCHEC :', err.message);
  process.exit(1);
});
