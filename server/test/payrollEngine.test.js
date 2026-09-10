import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePph21Monthly,
  calculateBpjsEmployeeDeductions,
  calculateThr,
  isBelowMinimumWage,
} from '../payrollEngine.js';

test('PPh 21: income at or below annual PTKP owes no tax', () => {
  // TK/0 PTKP is 54,000,000/yr -> well above a 3jt/month salary annualized.
  assert.equal(calculatePph21Monthly(3_000_000, 'TK/0'), 0);
});

test('PPh 21: a known mid-income case falls in the 5% bracket only', () => {
  // 8jt/month gross; biaya jabatan 5% = 400rb/month (under the 500rb cap) -> 4.8jt/yr;
  // annual net 91.2jt minus TK/0 PTKP 54jt = 37.2jt taxable, inside the first 60jt/5% band.
  const monthly = calculatePph21Monthly(8_000_000, 'TK/0');
  assert.equal(monthly, Math.round((37_200_000 * 0.05) / 12));
});

test('PPh 21: higher PTKP status (more dependents) lowers or matches the tax', () => {
  const tk0 = calculatePph21Monthly(15_000_000, 'TK/0');
  const k3 = calculatePph21Monthly(15_000_000, 'K/3');
  assert.ok(k3 <= tk0);
});

test('BPJS: employee deductions scale with salary up to the contribution caps', () => {
  const low = calculateBpjsEmployeeDeductions(5_000_000);
  assert.equal(low.kesehatan, 50_000); // 1% of 5jt, under the 12jt cap
  assert.equal(low.jht, 100_000); // 2% of 5jt
  assert.equal(low.jp, 50_000); // 1% of 5jt, under the JP cap
  assert.equal(low.total, low.kesehatan + low.jht + low.jp);

  // Above both caps: Kesehatan and JP stop growing, JHT keeps scaling with real salary.
  const high = calculateBpjsEmployeeDeductions(50_000_000);
  assert.equal(high.kesehatan, 120_000); // 1% of the 12jt cap
  assert.equal(high.jht, 1_000_000); // 2% of 50jt, uncapped
});

test('THR: full year of tenure pays a full month, partial tenure pro-rates', () => {
  const ref = new Date('2026-04-01');
  assert.equal(calculateThr(10_000_000, '2020-01-01', ref), 10_000_000);
  // Joined 6 months before the reference date -> half a month's pay.
  assert.equal(calculateThr(10_000_000, '2025-10-01', ref), 5_000_000);
  // Joined the same month as the reference date -> no THR yet.
  assert.equal(calculateThr(10_000_000, '2026-04-01', ref), 0);
});

test('minimum wage check flags pay below the configured regional floor', () => {
  assert.equal(isBelowMinimumWage(4_000_000, 5_067_381), true);
  assert.equal(isBelowMinimumWage(6_000_000, 5_067_381), false);
});
