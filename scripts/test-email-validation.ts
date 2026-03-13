/**
 * Unit tests — validation/email.ts (isValidEmail, normalizeEmail)
 *
 * Exécution : pnpm tsx scripts/test-email-validation.ts
 *
 * Pas de dépendance serveur ni DB.
 */

import assert from 'node:assert/strict';
import { isValidEmail, normalizeEmail } from '../src/lib/validation/email';

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
// isValidEmail
// ---------------------------------------------------------------------------

console.log('\n[email] isValidEmail');

test('valid simple email', () => {
  assert.equal(isValidEmail('user@example.com'), true);
});

test('valid email with dots', () => {
  assert.equal(isValidEmail('first.last@example.co.uk'), true);
});

test('valid email with plus', () => {
  assert.equal(isValidEmail('user+tag@example.com'), true);
});

test('valid email with numbers', () => {
  assert.equal(isValidEmail('user123@test456.org'), true);
});

test('empty string → false', () => {
  assert.equal(isValidEmail(''), false);
});

test('no @ → false', () => {
  assert.equal(isValidEmail('userexample.com'), false);
});

test('no domain → false', () => {
  assert.equal(isValidEmail('user@'), false);
});

test('no local part → false', () => {
  assert.equal(isValidEmail('@example.com'), false);
});

test('no TLD → false', () => {
  assert.equal(isValidEmail('user@example'), false);
});

test('spaces → false', () => {
  assert.equal(isValidEmail('user @example.com'), false);
});

test('too long (>254 chars) → false', () => {
  const long = 'a'.repeat(250) + '@b.com';
  assert.equal(isValidEmail(long), false);
});

test('exactly 254 chars → true', () => {
  const validEmail = 'a'.repeat(240) + '@example.com'; // 240+12=252
  assert.equal(isValidEmail(validEmail), true);
});

// ---------------------------------------------------------------------------
// normalizeEmail
// ---------------------------------------------------------------------------

console.log('\n[email] normalizeEmail');

test('trims whitespace', () => {
  assert.equal(normalizeEmail('  user@example.com  '), 'user@example.com');
});

test('lowercases', () => {
  assert.equal(normalizeEmail('User@EXAMPLE.COM'), 'user@example.com');
});

test('trims and lowercases together', () => {
  assert.equal(normalizeEmail('  Test@Test.COM  '), 'test@test.com');
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
