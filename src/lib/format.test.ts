import { describe, it, expect } from 'vitest';
import { formatIDR } from './format';

// Intl.NumberFormat's id-ID currency output separates "Rp" from the digits with a
// non-breaking space (code point 160), not a regular space (32) — the two look
// identical in an editor or terminal, so build it from the code point instead of
// typing the character directly.
const NBSP = String.fromCharCode(160);

describe('formatIDR', () => {
  it('formats a whole-rupiah amount with thousands separators', () => {
    expect(formatIDR(15500000)).toBe(`Rp${NBSP}15.500.000`);
  });

  it('formats zero', () => {
    expect(formatIDR(0)).toBe(`Rp${NBSP}0`);
  });

  it('formats a negative amount (e.g. a deduction total)', () => {
    expect(formatIDR(-500000)).toBe(`-Rp${NBSP}500.000`);
  });
});
