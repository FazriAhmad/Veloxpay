import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MONTH_PATTERN,
  parseLineItems,
  parseOvertimeHours,
  calculateOvertimePay,
  canTransition,
  isDeletable,
  rolesForTransition,
  parseText,
  SLIP_STATUSES,
} from '../slipRules.js';

test('a month must be YYYY-MM with a real month number', () => {
  for (const ok of ['2026-01', '2026-09', '2026-12']) assert.ok(MONTH_PATTERN.test(ok), ok);
  for (const bad of ['2026-00', '2026-13', '2026-9', '26-09', '2026/09', '', '2026-09-01', 'abcd-ef'])
    assert.ok(!MONTH_PATTERN.test(bad), `should reject ${JSON.stringify(bad)}`);
});

test('line items: valid input is cleaned down to name and amount', () => {
  const { items, error } = parseLineItems(
    [{ name: '  Transport ', amount: '500000', extra: 'dropped', id: 7 }, { name: 'Makan', amount: 250000 }],
    'Tunjangan'
  );
  assert.equal(error, undefined);
  assert.deepEqual(items, [
    { name: 'Transport', amount: 500000 },
    { name: 'Makan', amount: 250000 },
  ]);
});

test('line items: absent means an empty list, not an error', () => {
  assert.deepEqual(parseLineItems(undefined, 'x').items, []);
  assert.deepEqual(parseLineItems(null, 'x').items, []);
});

test('line items: non-numeric amounts are rejected instead of becoming NaN', () => {
  for (const amount of ['abc', 'Infinity', NaN, Infinity, '', '   ', null, undefined, {}, [], '1e999'])
    assert.ok(parseLineItems([{ name: 'x', amount }], 'T').error, `should reject ${String(amount)}`);
});

test('line items: negative or absurdly large amounts are rejected', () => {
  assert.ok(parseLineItems([{ name: 'x', amount: -1 }], 'T').error);
  assert.ok(parseLineItems([{ name: 'x', amount: 1e12 }], 'T').error);
  assert.equal(parseLineItems([{ name: 'x', amount: 0 }], 'T').error, undefined, 'zero is a legitimate amount');
});

test('line items: name is required and bounded; shape is checked', () => {
  assert.ok(parseLineItems([{ amount: 5 }], 'T').error);
  assert.ok(parseLineItems([{ name: '   ', amount: 5 }], 'T').error);
  assert.ok(parseLineItems([{ name: 'a'.repeat(101), amount: 5 }], 'T').error);
  assert.ok(parseLineItems('nope', 'T').error);
  assert.ok(parseLineItems([null], 'T').error);
  assert.ok(parseLineItems(Array.from({ length: 51 }, () => ({ name: 'x', amount: 1 })), 'T').error);
});

test('overtime hours: defaults to 0, accepts a range, rejects nonsense', () => {
  assert.equal(parseOvertimeHours(undefined).hours, 0);
  assert.equal(parseOvertimeHours('').hours, 0);
  assert.equal(parseOvertimeHours('12.5').hours, 12.5);
  assert.equal(parseOvertimeHours(0).hours, 0);
  for (const bad of ['abc', -1, 745, NaN, Infinity]) assert.ok(parseOvertimeHours(bad).error, String(bad));
});

test('overtime pay uses the same formula the payslip screen always used', () => {
  // 17,300,000 / 173 = 100,000 per hour; 10h at 1.5x = 1,500,000
  assert.equal(calculateOvertimePay(17_300_000, 10), 1_500_000);
  assert.equal(calculateOvertimePay(10_000_000, 0), 0);
});

test('status transitions: the normal path is allowed', () => {
  assert.ok(canTransition('Draft', 'Approved'));
  assert.ok(canTransition('Draft', 'Pending Approval'));
  assert.ok(canTransition('Pending Approval', 'Approved'));
  assert.ok(canTransition('Approved', 'Paid'));
  assert.ok(canTransition('Approved', 'Draft'), 'an approval can be withdrawn before payment');
});

test('status transitions: Paid is final and nothing skips approval', () => {
  assert.ok(!canTransition('Draft', 'Paid'), 'cannot pay a slip that was never approved');
  assert.ok(!canTransition('Pending Approval', 'Paid'));
  for (const to of SLIP_STATUSES) assert.ok(!canTransition('Paid', to), `Paid -> ${to} must be refused`);
});

test('status transitions: staying put and unknown statuses are refused', () => {
  for (const s of SLIP_STATUSES) assert.ok(!canTransition(s, s), `${s} -> ${s}`);
  assert.ok(!canTransition('Draft', 'Cancelled'));
  assert.ok(!canTransition('Nope', 'Draft'));
  assert.ok(!canTransition(undefined, 'Draft'));
});

test('only drafts can be deleted', () => {
  assert.ok(isDeletable('Draft'));
  assert.ok(isDeletable('Pending Approval'));
  assert.ok(!isDeletable('Approved'));
  assert.ok(!isDeletable('Paid'));
});

test('finance prepares, approver releases, admin can do both', () => {
  assert.deepEqual(rolesForTransition('Draft', 'Pending Approval'), ['admin', 'finance']);
  for (const [from, to] of [['Draft', 'Approved'], ['Pending Approval', 'Approved'], ['Approved', 'Paid'], ['Approved', 'Draft']]) {
    assert.ok(!rolesForTransition(from, to).includes('finance'), `finance must not do ${from} -> ${to}`);
    assert.ok(rolesForTransition(from, to).includes('approver'), from + to);
  }
  assert.ok(rolesForTransition('Pending Approval', 'Draft').includes('finance'));
});

test('parseText trims, nulls empties, and enforces length and required', () => {
  const opts = { max: 5, label: 'Catatan' };
  assert.equal(parseText('  abc ', opts).text, 'abc');
  for (const empty of [undefined, null, '', '   ']) assert.equal(parseText(empty, opts).text, null);
  assert.ok(parseText('', { ...opts, required: true }).error);
  assert.ok(parseText('   ', { ...opts, required: true }).error);
  assert.ok(parseText('abcdef', opts).error);
  assert.ok(parseText(123, opts).error);
});
