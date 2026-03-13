/**
 * Master smoke test runner.
 *
 * Usage:
 *   pnpm smoke:all                    # Run all tests
 *   pnpm smoke:all -- --phase=0       # Unit tests only (no server)
 *   pnpm smoke:all -- --category=auth # Auth tests only
 *   pnpm smoke:all -- --stop-on-fail  # Stop on first failure
 *
 * Environment:
 *   BASE_URL=http://localhost:3000 (default)
 *   ADMIN_EMAIL / ADMIN_PASSWORD
 *   TEST_EMAIL / TEST_PASSWORD
 */

import { execSync } from 'child_process';

type TestEntry = {
  name: string;
  script: string;
  phase: number;
  category: string;
};

const TESTS: TestEntry[] = [
  // Phase 0 — Unit tests (no server required)
  { name: 'money-utils', script: 'scripts/test-money-utils.ts', phase: 0, category: 'unit' },
  { name: 'parsers', script: 'scripts/test-parsers.ts', phase: 0, category: 'unit' },
  { name: 'pdf-sanitize', script: 'scripts/test-pdf-sanitize.ts', phase: 0, category: 'unit' },
  { name: 'pricing', script: 'scripts/test-pricing.ts', phase: 0, category: 'unit' },
  { name: 'date-utils', script: 'scripts/test-date-utils.ts', phase: 0, category: 'unit' },
  { name: 'email-validation', script: 'scripts/test-email-validation.ts', phase: 0, category: 'unit' },

  // Phase 1 — Existing smoke tests (pro domain)
  { name: 'auth', script: 'scripts/smoke-auth.ts', phase: 1, category: 'auth' },
  { name: 'wiring', script: 'scripts/smoke-wiring.ts', phase: 1, category: 'core' },
  { name: 'website', script: 'scripts/smoke-website.ts', phase: 1, category: 'core' },
  { name: 'nav-surface', script: 'scripts/smoke-nav-surface.ts', phase: 1, category: 'core' },
  { name: 'api-contracts', script: 'scripts/smoke-api-contracts.ts', phase: 1, category: 'core' },
  { name: 'settings', script: 'scripts/smoke-settings.ts', phase: 1, category: 'settings' },
  { name: 'references', script: 'scripts/smoke-references.ts', phase: 1, category: 'references' },
  { name: 'references-consumption', script: 'scripts/smoke-references-consumption.ts', phase: 1, category: 'references' },
  { name: 'clients-delete', script: 'scripts/smoke-clients-delete.ts', phase: 1, category: 'clients' },
  { name: 'clients-gdpr', script: 'scripts/smoke-clients-gdpr.ts', phase: 1, category: 'clients' },
  { name: 'finance-wiring', script: 'scripts/smoke-finance-wiring.ts', phase: 1, category: 'finance' },
  { name: 'finance-advanced', script: 'scripts/smoke-finance-advanced.ts', phase: 1, category: 'finance' },
  { name: 'billing-wiring', script: 'scripts/smoke-billing-wiring.ts', phase: 1, category: 'billing' },
  { name: 'invoice-reservation', script: 'scripts/smoke-invoice-reservation.ts', phase: 1, category: 'billing' },
  { name: 'services-import', script: 'scripts/smoke-services-import.ts', phase: 1, category: 'billing' },
  { name: 'ledger', script: 'scripts/smoke-ledger.ts', phase: 1, category: 'accounting' },
  { name: 'project-accounting', script: 'scripts/smoke-project-accounting.ts', phase: 1, category: 'accounting' },
  { name: 'projects-mvp', script: 'scripts/smoke-projects-mvp.ts', phase: 1, category: 'projects' },
  { name: 'tasks-billing-link', script: 'scripts/smoke-tasks-billing-link.ts', phase: 1, category: 'projects' },
  { name: 'planning', script: 'scripts/smoke-planning.ts', phase: 1, category: 'projects' },
  { name: 'processes', script: 'scripts/smoke-processes.ts', phase: 1, category: 'processes' },
  { name: 'process-implicit', script: 'scripts/smoke-process-implicit.ts', phase: 1, category: 'processes' },
  { name: 'team-employees', script: 'scripts/smoke-team-employees.ts', phase: 1, category: 'team' },
  { name: 'stock', script: 'scripts/smoke-stock.ts', phase: 1, category: 'stock' },
  { name: 'invites', script: 'scripts/smoke-invites.ts', phase: 1, category: 'invites' },

  // Phase 2 — Personal domain (new)
  { name: 'personal-accounts', script: 'scripts/smoke-personal-accounts.ts', phase: 2, category: 'personal' },
  { name: 'personal-transactions', script: 'scripts/smoke-personal-transactions.ts', phase: 2, category: 'personal' },
  { name: 'personal-budgets', script: 'scripts/smoke-personal-budgets.ts', phase: 2, category: 'personal' },
  { name: 'personal-categories', script: 'scripts/smoke-personal-categories.ts', phase: 2, category: 'personal' },
  { name: 'personal-subscriptions', script: 'scripts/smoke-personal-subscriptions.ts', phase: 2, category: 'personal' },
  { name: 'personal-savings', script: 'scripts/smoke-personal-savings.ts', phase: 2, category: 'personal' },
  { name: 'personal-summary', script: 'scripts/smoke-personal-summary.ts', phase: 2, category: 'personal' },

  // Phase 3 — Auth + Security
  { name: 'auth-lifecycle', script: 'scripts/smoke-auth-lifecycle.ts', phase: 3, category: 'auth' },
  { name: 'data-isolation', script: 'scripts/smoke-data-isolation.ts', phase: 3, category: 'security' },
  { name: 'account-management', script: 'scripts/smoke-account-management.ts', phase: 3, category: 'auth' },

  // Phase 4 — Pro domain gaps
  { name: 'calendar', script: 'scripts/smoke-calendar.ts', phase: 4, category: 'calendar' },
  { name: 'prospects', script: 'scripts/smoke-prospects.ts', phase: 4, category: 'clients' },
  { name: 'documents', script: 'scripts/smoke-documents.ts', phase: 4, category: 'documents' },
  { name: 'payment-links', script: 'scripts/smoke-payment-links.ts', phase: 4, category: 'billing' },
  { name: 'notifications-pro', script: 'scripts/smoke-notifications-pro.ts', phase: 4, category: 'notifications' },
  { name: 'vault', script: 'scripts/smoke-vault.ts', phase: 4, category: 'vault' },
  { name: 'goals', script: 'scripts/smoke-goals.ts', phase: 4, category: 'goals' },
  { name: 'interactions', script: 'scripts/smoke-interactions.ts', phase: 4, category: 'interactions' },
  { name: 'search', script: 'scripts/smoke-search.ts', phase: 4, category: 'search' },

  // Phase 5 — Secondary modules
  { name: 'e-invoices', script: 'scripts/smoke-e-invoices.ts', phase: 5, category: 'billing' },
  { name: 'expense-reports', script: 'scripts/smoke-expense-reports.ts', phase: 5, category: 'finance' },
  { name: 'store', script: 'scripts/smoke-store.ts', phase: 5, category: 'store' },
  { name: 'share', script: 'scripts/smoke-share.ts', phase: 5, category: 'share' },
  { name: 'conversations', script: 'scripts/smoke-conversations.ts', phase: 5, category: 'conversations' },
  { name: 'associates', script: 'scripts/smoke-associates.ts', phase: 5, category: 'finance' },

  // Phase 6 — Cross-cutting
  { name: 'rate-limiting', script: 'scripts/smoke-rate-limiting.ts', phase: 6, category: 'security' },
];

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const phaseArg = args.find((a) => a.startsWith('--phase='));
const categoryArg = args.find((a) => a.startsWith('--category='));
const stopOnFail = args.includes('--stop-on-fail');
const listOnly = args.includes('--list');

const filterPhase = phaseArg ? Number(phaseArg.split('=')[1]) : null;
const filterCategory = categoryArg ? categoryArg.split('=')[1] : null;

let tests = TESTS;
if (filterPhase !== null) tests = tests.filter((t) => t.phase === filterPhase);
if (filterCategory) tests = tests.filter((t) => t.category === filterCategory);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

if (listOnly) {
  console.log(`\n  Tests disponibles (${tests.length}) :\n`);
  for (const t of tests) {
    console.log(`    [P${t.phase}] [${t.category}] ${t.name} → ${t.script}`);
  }
  process.exit(0);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  Smoke test runner — ${tests.length} test(s)`);
if (filterPhase !== null) console.log(`  Filtre phase : ${filterPhase}`);
if (filterCategory) console.log(`  Filtre catégorie : ${filterCategory}`);
console.log(`${'═'.repeat(60)}\n`);

type Result = { name: string; ok: boolean; durationMs: number; error?: string };
const results: Result[] = [];

for (const t of tests) {
  const label = `[P${t.phase}] ${t.name}`;
  const start = Date.now();
  try {
    execSync(`pnpm tsx ${t.script}`, {
      stdio: 'pipe',
      timeout: 120_000,
      env: { ...process.env },
    });
    const ms = Date.now() - start;
    console.log(`  ✓ ${label} (${ms}ms)`);
    results.push({ name: t.name, ok: true, durationMs: ms });
  } catch (err) {
    const ms = Date.now() - start;
    const stderr = err && typeof err === 'object' && 'stderr' in err
      ? (err as { stderr: Buffer }).stderr?.toString().slice(0, 300)
      : '';
    console.error(`  ✗ ${label} (${ms}ms)`);
    if (stderr) console.error(`    ${stderr.split('\n')[0]}`);
    results.push({ name: t.name, ok: false, durationMs: ms, error: stderr });
    if (stopOnFail) {
      console.error('\n  --stop-on-fail : arrêt.');
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

console.log(`\n${'═'.repeat(60)}`);
console.log(`  Résultat : ${passed} passé(s), ${failed} échoué(s) — ${(totalMs / 1000).toFixed(1)}s`);

if (failed > 0) {
  console.log('\n  Échecs :');
  for (const r of results.filter((r) => !r.ok)) {
    console.log(`    ✗ ${r.name}`);
  }
}
console.log(`${'═'.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
