import { describe, expect, it } from 'vitest';
import { ACCOUNT_KINDS, isAccountKind } from './accountTypes';

describe('account kinds', () => {
  it('accepts the four types the user can pick', () => {
    for (const k of ['bank', 'savings', 'credit_card', 'wallet']) expect(isAccountKind(k)).toBe(true);
    expect(ACCOUNT_KINDS).toHaveLength(4);
  });

  it('rejects anything else, including empty and missing values', () => {
    for (const v of ['', 'cash', 'Savings', null, undefined, 3]) expect(isAccountKind(v)).toBe(false);
  });
});
