import { describe, expect, it } from 'vitest';
import { formatINR, paiseToPlain, parseBalanceToPaise, parseRupeesToPaise } from './money';

describe('parseRupeesToPaise', () => {
  it('converts whole and decimal rupees to paise', () => {
    expect(parseRupeesToPaise('640')).toBe(64000);
    expect(parseRupeesToPaise('12.5')).toBe(1250);
    expect(parseRupeesToPaise('12.05')).toBe(1205);
    expect(parseRupeesToPaise('1,00,000')).toBe(10_000_000);
  });

  it('rejects malformed, zero, and over-limit amounts', () => {
    expect(() => parseRupeesToPaise('12.345')).toThrow();
    expect(() => parseRupeesToPaise('abc')).toThrow();
    expect(() => parseRupeesToPaise('0')).toThrow();
    expect(() => parseRupeesToPaise('10000001')).toThrow(/crore/);
  });
});

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(64000)).toBe('₹640');
    expect(formatINR(2_000_000)).toBe('₹20,000');
    expect(formatINR(1_000_000_00)).toBe('₹10,00,000');
    expect(formatINR(9_240_000)).toBe('₹92,400');
  });

  it('keeps paise only when non-zero, and formats negatives', () => {
    expect(formatINR(1205)).toBe('₹12.05');
    expect(formatINR(1200, { alwaysDecimals: true })).toBe('₹12.00');
    expect(formatINR(-1_000_000)).toBe('−₹10,000');
  });
});

describe('parseBalanceToPaise', () => {
  it('accepts zero, positive and negative balances', () => {
    expect(parseBalanceToPaise('0')).toBe(0);
    expect(parseBalanceToPaise('-0')).toBe(0);
    expect(parseBalanceToPaise('12,345.5')).toBe(1_234_550);
    expect(parseBalanceToPaise('-2500')).toBe(-250_000);
    expect(parseBalanceToPaise('−2500.75')).toBe(-250_075);
  });

  it('rejects anything that is not a number', () => {
    for (const v of ['', '-', 'abc', '1.234', '--5', '5-']) expect(() => parseBalanceToPaise(v)).toThrow();
  });

  it('caps balances at ₹100 crore', () => {
    expect(() => parseBalanceToPaise('1000000001')).toThrow();
  });
});

describe('paiseToPlain', () => {
  it('writes rupees with two decimals and no symbol', () => {
    expect(paiseToPlain(0)).toBe('0.00');
    expect(paiseToPlain(5)).toBe('0.05');
    expect(paiseToPlain(123_450)).toBe('1234.50');
    expect(paiseToPlain(-123_450)).toBe('-1234.50');
  });
});
