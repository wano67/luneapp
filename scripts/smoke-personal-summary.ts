/**
 * Smoke test — Personal summary + analytics endpoints
 *
 * Exécution : BASE_URL=http://localhost:3000 pnpm tsx scripts/smoke-personal-summary.ts
 */

import { createRequester, loginPersonal, assert } from './smoke-utils';

const baseUrl = process.env.BASE_URL?.trim() || 'http://localhost:3000';
const { request } = createRequester(baseUrl);

async function main() {
  console.log('[personal-summary] Démarrage…');

  await loginPersonal(request);
  console.log('  ✓ Login');

  // ── SUMMARY ──
  const { json: summaryJson } = await request('/api/personal/summary');
  const summary = summaryJson as Record<string, unknown>;
  assert(summary.kpis && typeof summary.kpis === 'object', 'Summary returns kpis');
  const kpis = summary.kpis as Record<string, unknown>;
  assert('totalBalanceCents' in kpis, 'kpis has totalBalanceCents');
  assert('monthNetCents' in kpis, 'kpis has monthNetCents');
  assert(Array.isArray(summary.accounts), 'Summary returns accounts[]');
  assert(Array.isArray(summary.latestTransactions), 'Summary returns latestTransactions[]');
  console.log('  ✓ Summary endpoint');

  // ── SUMMARY with period ──
  const { json: summary30 } = await request('/api/personal/summary?days=30');
  assert((summary30 as Record<string, unknown>).kpis, 'Summary ?days=30 returns kpis');
  console.log('  ✓ Summary ?days=30');

  // ── ANALYTICS ──
  const { json: analyticsJson } = await request('/api/personal/analytics');
  const analytics = analyticsJson as Record<string, unknown>;
  assert('totalBalanceCents' in analytics, 'Analytics has totalBalanceCents');
  assert('monthIncomeCents' in analytics, 'Analytics has monthIncomeCents');
  assert('monthExpenseCents' in analytics, 'Analytics has monthExpenseCents');
  assert(Array.isArray(analytics.expensesByCategory), 'Analytics has expensesByCategory[]');
  assert(Array.isArray(analytics.balanceTrend), 'Analytics has balanceTrend[]');
  console.log('  ✓ Analytics endpoint');

  // ── NOTIFICATIONS ──
  const { json: notifsJson } = await request('/api/personal/notifications');
  const notifs = notifsJson as Record<string, unknown>;
  assert(Array.isArray(notifs.items), 'Notifications returns items[]');
  assert('unreadCount' in notifs, 'Notifications returns unreadCount');
  console.log(`  ✓ Notifications (${(notifs.items as unknown[]).length} items, unread=${notifs.unreadCount})`);

  console.log('[personal-summary] OK\n');
}

main().catch((err) => {
  console.error('[personal-summary] ÉCHEC :', err.message);
  process.exit(1);
});
