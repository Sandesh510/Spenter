import { describe, expect, it } from 'vitest';
import { pickAccount } from './defaultAccount';

const accounts = [{ id: 'a' }, { id: 'b' }];

describe('pickAccount', () => {
  it('uses the default account when it exists', () => {
    expect(pickAccount(accounts, 'b')).toBe('b');
  });
  it('falls back to the first account when no default is set or it was deleted', () => {
    expect(pickAccount(accounts, null)).toBe('a');
    expect(pickAccount(accounts, 'gone')).toBe('a');
  });
  it('returns null when there are no accounts', () => {
    expect(pickAccount([], 'a')).toBeNull();
  });
});
