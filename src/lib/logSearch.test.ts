import { describe, expect, it } from 'vitest';
import { matchesSearch } from './logSearch';

const entry = { title: 'Swiggy dinner', category: 'Food Wants', account: 'Rewards', description: 'Swiggy dinner', amountPaise: 124_900 };

describe('matchesSearch', () => {
  it('matches note, category, account and amount, in any case', () => {
    for (const q of ['swiggy', 'FOOD', 'rewards', '1249', '1,249']) expect(matchesSearch(q, entry)).toBe(true);
  });

  it('needs every word to match', () => {
    expect(matchesSearch('swiggy rewards', entry)).toBe(true);
    expect(matchesSearch('swiggy cash', entry)).toBe(false);
  });

  it('an empty search matches everything', () => {
    expect(matchesSearch('  ', entry)).toBe(true);
  });
});
