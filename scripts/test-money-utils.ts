import assert from 'node:assert/strict';
import {
  formatCentsToEuroInput,
  parseEuroToCents,
  sanitizeEuroInput,
} from '../src/lib/money';

assert.equal(parseEuroToCents('100'), 10000);
assert.equal(parseEuroToCents('100,50'), 10050);
assert.equal(parseEuroToCents('100.5'), 10050);
assert.equal(parseEuroToCents('0,01'), 1);
assert.ok(Number.isNaN(parseEuroToCents('')));
assert.ok(Number.isNaN(parseEuroToCents('abc')));

assert.equal(formatCentsToEuroInput(10000), '100');
assert.equal(formatCentsToEuroInput(10050), '100,50');
assert.equal(formatCentsToEuroInput('2500'), '25');

assert.equal(sanitizeEuroInput('1 234,50 €'), '1234,50');
assert.equal(sanitizeEuroInput('99.9'), '99,9');
assert.equal(sanitizeEuroInput('12,345'), '12,34');

console.log('money utils: ok');
