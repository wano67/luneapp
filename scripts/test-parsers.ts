/**
 * Unit tests — parsers.ts + json.ts (deepSerialize / jsonb)
 *
 * Exécution : pnpm tsx scripts/test-parsers.ts
 *
 * Pas de dépendance externe : node:assert uniquement.
 * Ces tests tournent sans dev server ni DB.
 */

import assert from 'node:assert/strict';
import { parseId, parseIdOpt, parseDate, parseDateOpt, parseEnum, parseStr, parseBool, parseIdArray, RouteParseError } from '../src/server/http/parsers';
import { deepSerialize } from '../src/server/http/json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function throws(fn: () => unknown, expectedMessage?: string) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    if (expectedMessage) {
      assert.ok(
        e instanceof RouteParseError,
        `Expected RouteParseError but got ${e instanceof Error ? e.constructor.name : typeof e}`
      );
      assert.ok(
        e.message.includes(expectedMessage),
        `Expected message to include "${expectedMessage}", got: "${(e as Error).message}"`
      );
    }
  }
  assert.ok(threw, 'Expected function to throw but it did not');
}

// ---------------------------------------------------------------------------
// parseId
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseId');

test('valid numeric string → BigInt', () => {
  assert.equal(parseId('123'), BigInt(123));
});

test('large ID (BigInt safe)', () => {
  assert.equal(parseId('9007199254740993'), BigInt('9007199254740993'));
});

test('empty string → RouteParseError', () => {
  throws(() => parseId(''), 'ID invalide');
});

test('non-numeric string → RouteParseError', () => {
  throws(() => parseId('abc'), 'ID invalide');
});

test('null → RouteParseError', () => {
  throws(() => parseId(null as unknown as string), 'ID invalide');
});

test('float string → RouteParseError', () => {
  throws(() => parseId('1.5'), 'ID invalide');
});

// ---------------------------------------------------------------------------
// parseIdOpt
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseIdOpt');

test('null → null', () => {
  assert.equal(parseIdOpt(null), null);
});

test('undefined → null', () => {
  assert.equal(parseIdOpt(undefined), null);
});

test('empty string → null', () => {
  assert.equal(parseIdOpt(''), null);
});

test('valid string → BigInt', () => {
  assert.equal(parseIdOpt('42'), BigInt(42));
});

test('invalid string → RouteParseError', () => {
  throws(() => parseIdOpt('xyz'), 'ID invalide');
});

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseDate');

test('ISO date string → Date', () => {
  const d = parseDate('2025-01-15T10:30:00.000Z');
  assert.ok(d instanceof Date);
  assert.equal(d.toISOString(), '2025-01-15T10:30:00.000Z');
});

test('date-only string → Date', () => {
  const d = parseDate('2025-06-01');
  assert.ok(d instanceof Date);
  assert.ok(!isNaN(d.getTime()));
});

test('invalid date string → RouteParseError', () => {
  throws(() => parseDate('not-a-date'), 'invalide');
});

test('number → RouteParseError', () => {
  throws(() => parseDate(12345), 'invalide');
});

test('null → RouteParseError', () => {
  throws(() => parseDate(null), 'invalide');
});

// ---------------------------------------------------------------------------
// parseDateOpt
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseDateOpt');

test('null → null', () => assert.equal(parseDateOpt(null), null));
test('undefined → null', () => assert.equal(parseDateOpt(undefined), null));
test('empty string → null', () => assert.equal(parseDateOpt(''), null));
test('valid date → Date', () => {
  const d = parseDateOpt('2025-01-01');
  assert.ok(d instanceof Date);
});

// ---------------------------------------------------------------------------
// parseEnum
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseEnum');

const FINANCE_TYPES = ['INCOME', 'EXPENSE'] as const;

test('valid enum value → value', () => {
  assert.equal(parseEnum('INCOME', FINANCE_TYPES), 'INCOME');
});

test('invalid enum value → RouteParseError', () => {
  throws(() => parseEnum('REFUND', FINANCE_TYPES, 'type'), 'INCOME, EXPENSE');
});

test('undefined → RouteParseError', () => {
  throws(() => parseEnum(undefined, FINANCE_TYPES));
});

// ---------------------------------------------------------------------------
// parseStr
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseStr');

test('trims whitespace', () => {
  assert.equal(parseStr('  hello  '), 'hello');
});

test('empty string → null', () => {
  assert.equal(parseStr(''), null);
});

test('null → null', () => {
  assert.equal(parseStr(null), null);
});

test('maxLength ok → returns value', () => {
  assert.equal(parseStr('abc', 5), 'abc');
});

test('maxLength exceeded → RouteParseError', () => {
  throws(() => parseStr('toolong', 3), 'trop long');
});

// ---------------------------------------------------------------------------
// parseBool
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseBool');

test('true → true', () => assert.equal(parseBool(true), true));
test('"true" → true', () => assert.equal(parseBool('true'), true));
test('false → false', () => assert.equal(parseBool(false), false));
test('"false" → false', () => assert.equal(parseBool('false'), false));
test('null → false', () => assert.equal(parseBool(null), false));
test('1 → true', () => assert.equal(parseBool(1), true));
test('0 → false', () => assert.equal(parseBool(0), false));

// ---------------------------------------------------------------------------
// parseIdArray
// ---------------------------------------------------------------------------

console.log('\n[parsers] parseIdArray');

test('valid array → BigInt[]', () => {
  const result = parseIdArray(['1', '2', '3']);
  assert.deepEqual(result, [BigInt(1), BigInt(2), BigInt(3)]);
});

test('non-array → RouteParseError', () => {
  throws(() => parseIdArray('not-array'), 'tableau');
});

test('array with invalid ID → RouteParseError', () => {
  throws(() => parseIdArray(['1', 'bad', '3']), 'invalide');
});

// ---------------------------------------------------------------------------
// deepSerialize
// ---------------------------------------------------------------------------

console.log('\n[json] deepSerialize');

test('BigInt → string (safe)', () => {
  assert.equal(deepSerialize(BigInt(123456)), '123456');
});

test('BigInt → string (beyond MAX_SAFE_INTEGER — must use BigInt literal)', () => {
  // IMPORTANT : ne jamais écrire BigInt(9007199254740993) — perd la précision.
  // Toujours utiliser BigInt('9007199254740993') pour les grands IDs.
  assert.equal(deepSerialize(BigInt('9007199254740993')), '9007199254740993');
});

test('Date → ISO string', () => {
  const d = new Date('2025-06-01T00:00:00.000Z');
  assert.equal(deepSerialize(d), '2025-06-01T00:00:00.000Z');
});

test('null → null', () => {
  assert.equal(deepSerialize(null), null);
});

test('string passthrough', () => {
  assert.equal(deepSerialize('hello'), 'hello');
});

test('number passthrough', () => {
  assert.equal(deepSerialize(42), 42);
});

test('boolean passthrough', () => {
  assert.equal(deepSerialize(true), true);
});

test('nested object with BigInt', () => {
  const input = { id: BigInt(1), name: 'test', sub: { value: BigInt(999) } };
  const result = deepSerialize(input) as Record<string, unknown>;
  assert.equal(result.id, '1');
  assert.equal(result.name, 'test');
  assert.equal((result.sub as Record<string, unknown>).value, '999');
});

test('array of BigInt', () => {
  const result = deepSerialize([BigInt(1), BigInt(2)]) as unknown[];
  assert.deepEqual(result, ['1', '2']);
});

test('array of objects with BigInt', () => {
  const result = deepSerialize([{ id: BigInt(1) }, { id: BigInt(2) }]) as Array<Record<string, unknown>>;
  assert.equal(result[0].id, '1');
  assert.equal(result[1].id, '2');
});

test('mixed Prisma-like record', () => {
  const record = {
    id: BigInt(42),
    businessId: BigInt(10),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    amountCents: BigInt(15000),
    label: 'Facture #001',
    status: 'PAID',
    clientId: null,
    tags: [{ id: BigInt(5), name: 'client' }],
  };
  const out = deepSerialize(record) as Record<string, unknown>;
  assert.equal(out.id, '42');
  assert.equal(out.businessId, '10');
  assert.equal(out.createdAt, '2025-01-01T00:00:00.000Z');
  assert.equal(out.amountCents, '15000');
  assert.equal(out.label, 'Facture #001');
  assert.equal(out.clientId, null);
  assert.equal((out.tags as Array<Record<string, unknown>>)[0].id, '5');
});

test('JSON.stringify on deepSerialize output succeeds (no BigInt error)', () => {
  const input = { id: BigInt(1), amount: BigInt(99999) };
  const serialized = deepSerialize(input);
  // This should not throw
  const str = JSON.stringify(serialized);
  assert.ok(typeof str === 'string');
  assert.ok(str.includes('"1"'));
  assert.ok(str.includes('"99999"'));
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
