import assert from 'node:assert/strict';
import { computeOutstanding } from '../src/lib/accounting';

assert.equal(computeOutstanding(10000, 2500), 7500);
assert.equal(computeOutstanding(0, 1000), 0);
assert.equal(computeOutstanding(5000, 5000), 0);
assert.equal(computeOutstanding(5000, Number.NaN), 5000);

console.log('computeOutstanding: ok');
