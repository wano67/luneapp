/**
 * Unit tests — date.ts helpers
 *
 * Exécution : pnpm tsx scripts/test-date-utils.ts
 *
 * Pas de dépendance serveur ni DB.
 */

import assert from 'node:assert/strict';
import { addMonths, startOfMonth, monthKey, dayKey, startOfWeek, weekKey, addDays } from '../src/lib/date';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// addMonths
// ---------------------------------------------------------------------------

console.log('\n[date] addMonths');

test('+1 month from Jan → Feb', () => {
  const d = addMonths(new Date(2025, 0, 15), 1);
  assert.equal(d.getMonth(), 1);
  assert.equal(d.getFullYear(), 2025);
});

test('+12 months → next year', () => {
  const d = addMonths(new Date(2025, 5, 10), 12);
  assert.equal(d.getMonth(), 5);
  assert.equal(d.getFullYear(), 2026);
});

test('-1 month from Jan → Dec prev year', () => {
  const d = addMonths(new Date(2025, 0, 15), -1);
  assert.equal(d.getMonth(), 11);
  assert.equal(d.getFullYear(), 2024);
});

test('does not mutate original', () => {
  const original = new Date(2025, 3, 10);
  const originalTime = original.getTime();
  addMonths(original, 3);
  assert.equal(original.getTime(), originalTime);
});

// ---------------------------------------------------------------------------
// startOfMonth
// ---------------------------------------------------------------------------

console.log('\n[date] startOfMonth');

test('returns 1st at midnight', () => {
  const d = startOfMonth(new Date(2025, 5, 15, 14, 30));
  assert.equal(d.getDate(), 1);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
  assert.equal(d.getSeconds(), 0);
  assert.equal(d.getMonth(), 5);
});

test('does not mutate original', () => {
  const original = new Date(2025, 3, 20, 10, 30);
  const originalTime = original.getTime();
  startOfMonth(original);
  assert.equal(original.getTime(), originalTime);
});

// ---------------------------------------------------------------------------
// monthKey
// ---------------------------------------------------------------------------

console.log('\n[date] monthKey');

test('Jan 2025 → "2025-01"', () => {
  assert.equal(monthKey(new Date(2025, 0, 15)), '2025-01');
});

test('Dec 2025 → "2025-12"', () => {
  assert.equal(monthKey(new Date(2025, 11, 1)), '2025-12');
});

test('single-digit month padded', () => {
  assert.equal(monthKey(new Date(2025, 2, 5)), '2025-03');
});

// ---------------------------------------------------------------------------
// dayKey
// ---------------------------------------------------------------------------

console.log('\n[date] dayKey');

test('2025-01-05 → "2025-01-05"', () => {
  assert.equal(dayKey(new Date(2025, 0, 5)), '2025-01-05');
});

test('2025-12-31 → "2025-12-31"', () => {
  assert.equal(dayKey(new Date(2025, 11, 31)), '2025-12-31');
});

test('single-digit day padded', () => {
  assert.equal(dayKey(new Date(2025, 5, 3)), '2025-06-03');
});

// ---------------------------------------------------------------------------
// startOfWeek
// ---------------------------------------------------------------------------

console.log('\n[date] startOfWeek');

test('Wednesday → previous Monday', () => {
  // 2025-01-08 is a Wednesday
  const d = startOfWeek(new Date(2025, 0, 8));
  assert.equal(d.getDay(), 1); // Monday
  assert.equal(d.getDate(), 6);
});

test('Monday → same Monday', () => {
  // 2025-01-06 is a Monday
  const d = startOfWeek(new Date(2025, 0, 6));
  assert.equal(d.getDay(), 1);
  assert.equal(d.getDate(), 6);
});

test('Sunday → previous Monday', () => {
  // 2025-01-12 is a Sunday
  const d = startOfWeek(new Date(2025, 0, 12));
  assert.equal(d.getDay(), 1);
  assert.equal(d.getDate(), 6);
});

test('sets time to midnight', () => {
  const d = startOfWeek(new Date(2025, 0, 8, 15, 30));
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

// ---------------------------------------------------------------------------
// weekKey
// ---------------------------------------------------------------------------

console.log('\n[date] weekKey');

test('returns W-YYYY-MM-DD format', () => {
  const wk = weekKey(new Date(2025, 0, 8));
  assert.ok(wk.startsWith('W-'));
  assert.equal(wk, 'W-2025-01-06');
});

// ---------------------------------------------------------------------------
// addDays
// ---------------------------------------------------------------------------

console.log('\n[date] addDays');

test('+1 day', () => {
  const d = addDays(new Date(2025, 0, 31), 1);
  assert.equal(d.getMonth(), 1); // February
  assert.equal(d.getDate(), 1);
});

test('-1 day', () => {
  const d = addDays(new Date(2025, 1, 1), -1);
  assert.equal(d.getMonth(), 0); // January
  assert.equal(d.getDate(), 31);
});

test('+7 days', () => {
  const d = addDays(new Date(2025, 0, 1), 7);
  assert.equal(dayKey(d), '2025-01-08');
});

test('does not mutate original', () => {
  const original = new Date(2025, 0, 15);
  const originalTime = original.getTime();
  addDays(original, 5);
  assert.equal(original.getTime(), originalTime);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n${'─'.repeat(50)}`);
console.log(`Tests : ${passed}/${total} passés${failed > 0 ? ` | ${failed} ÉCHEC(S)` : ''}`);

if (failed > 0) {
  process.exit(1);
}
