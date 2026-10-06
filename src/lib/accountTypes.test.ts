import { describe, expect, it } from 'vitest';
import { ACCOUNT_KINDS, isAccountKind, isCreditCard, normaliseAccountKind } from './accountTypes';

describe('account kinds', () => {
  it('accepts the four types the user can pick', () => {
    for (const k of ['bank', 'savings', 'credit_card', 'wallet']) expect(isAccountKind(k)).toBe(true);
    expect(ACCOUNT_KINDS).toHaveLength(4);
  });

  it('rejects anything else, including empty and missing values', () => {
    for (const v of ['', 'cash', 'Savings', null, undefined, 3]) expect(isAccountKind(v)).toBe(false);
  });
});

describe('normaliseAccountKind', () => {
  it('keeps the four kinds as they are', () => {
    for (const k of ACCOUNT_KINDS) expect(normaliseAccountKind(k)).toBe(k);
  });

  it('reads older free-text kinds', () => {
    expect(normaliseAccountKind('Credit card')).toBe('credit_card');
    expect(normaliseAccountKind('credit-card')).toBe('credit_card');
    expect(normaliseAccountKind('Debit')).toBe('bank');
    expect(normaliseAccountKind('Cash')).toBe('wallet');
    expect(normaliseAccountKind('UPI wallet')).toBe('wallet');
    expect(normaliseAccountKind('Savings')).toBe('savings');
  });

  it('returns null when it cannot tell', () => {
    for (const v of ['', '  ', 'Gold', null, undefined, 7]) expect(normaliseAccountKind(v)).toBeNull();
  });

  it('spots credit cards in either form', () => {
    expect(isCreditCard('credit_card')).toBe(true);
    expect(isCreditCard('Credit card')).toBe(true);
    expect(isCreditCard('Debit')).toBe(false);
    expect(isCreditCard(null)).toBe(false);
  });
});
