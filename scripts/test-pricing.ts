/**
 * Unit tests — pricing.ts (computeDiscountedPrice, resolveServiceUnitPriceCents)
 *
 * Exécution : pnpm tsx scripts/test-pricing.ts
 *
 * Pas de dépendance serveur ni DB.
 */

import assert from 'node:assert/strict';
import { computeDiscountedPrice, resolveServiceUnitPriceCents } from '../src/server/services/pricing';

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
// computeDiscountedPrice
// ---------------------------------------------------------------------------

console.log('\n[pricing] computeDiscountedPrice');

test('no discount → same price', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000) }),
    BigInt(10000),
  );
});

test('NONE discount → same price', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'NONE', discountValue: 10 }),
    BigInt(10000),
  );
});

test('PERCENT 20% on 10000 → 8000', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: 20 }),
    BigInt(8000),
  );
});

test('PERCENT 50% on 10000 → 5000', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: 50 }),
    BigInt(5000),
  );
});

test('PERCENT 100% → 0', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: 100 }),
    BigInt(0),
  );
});

test('PERCENT 0% → same price', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: 0 }),
    BigInt(10000),
  );
});

test('PERCENT >100% clamped to 100%', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: 150 }),
    BigInt(0),
  );
});

test('PERCENT negative clamped to 0%', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: -10 }),
    BigInt(10000),
  );
});

test('PERCENT with float → truncated', () => {
  // 33.7 → trunc → 33, so 10000 * (100-33) / 100 = 6700
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: 33.7 }),
    BigInt(6700),
  );
});

test('AMOUNT 2000 on 10000 → 8000', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'AMOUNT', discountValue: 2000 }),
    BigInt(8000),
  );
});

test('AMOUNT exceeds price → 0 (not negative)', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(5000), discountType: 'AMOUNT', discountValue: 9000 }),
    BigInt(0),
  );
});

test('AMOUNT negative → clamped to 0', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'AMOUNT', discountValue: -500 }),
    BigInt(10000),
  );
});

test('PERCENT null discountValue → same price', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: null }),
    BigInt(10000),
  );
});

test('AMOUNT with NaN → same price', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'AMOUNT', discountValue: NaN }),
    BigInt(10000),
  );
});

test('PERCENT with Infinity → same price', () => {
  assert.equal(
    computeDiscountedPrice({ unitPriceCents: BigInt(10000), discountType: 'PERCENT', discountValue: Infinity }),
    BigInt(10000),
  );
});

// ---------------------------------------------------------------------------
// resolveServiceUnitPriceCents
// ---------------------------------------------------------------------------

console.log('\n[pricing] resolveServiceUnitPriceCents');

test('project price wins over all', () => {
  const r = resolveServiceUnitPriceCents({
    projectPriceCents: BigInt(5000),
    defaultPriceCents: BigInt(3000),
    tjmCents: BigInt(1000),
  });
  assert.equal(r.unitPriceCents, BigInt(5000));
  assert.equal(r.source, 'project');
  assert.equal(r.missingPrice, false);
});

test('default price when no project price', () => {
  const r = resolveServiceUnitPriceCents({
    projectPriceCents: null,
    defaultPriceCents: BigInt(3000),
    tjmCents: BigInt(1000),
  });
  assert.equal(r.unitPriceCents, BigInt(3000));
  assert.equal(r.source, 'default');
  assert.equal(r.missingPrice, false);
});

test('TJM when no project/default price', () => {
  const r = resolveServiceUnitPriceCents({
    projectPriceCents: null,
    defaultPriceCents: null,
    tjmCents: BigInt(1000),
  });
  assert.equal(r.unitPriceCents, BigInt(1000));
  assert.equal(r.source, 'tjm');
  assert.equal(r.missingPrice, false);
});

test('all null → missing, 0 cents', () => {
  const r = resolveServiceUnitPriceCents({
    projectPriceCents: null,
    defaultPriceCents: null,
    tjmCents: null,
  });
  assert.equal(r.unitPriceCents, BigInt(0));
  assert.equal(r.source, 'missing');
  assert.equal(r.missingPrice, true);
});

test('all undefined → missing', () => {
  const r = resolveServiceUnitPriceCents({});
  assert.equal(r.source, 'missing');
  assert.equal(r.missingPrice, true);
});

test('project price 0 is valid (not missing)', () => {
  const r = resolveServiceUnitPriceCents({
    projectPriceCents: BigInt(0),
    defaultPriceCents: BigInt(3000),
  });
  assert.equal(r.unitPriceCents, BigInt(0));
  assert.equal(r.source, 'project');
  assert.equal(r.missingPrice, false);
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
