import { describe, expect, it } from 'vitest';
import { recentCategories, repeatables, type RecentSource } from './recents';

const s = (category_id: string | null, amount_paise: number, description: string | null = null, type: RecentSource['type'] = 'spend'): RecentSource => ({ type, category_id, account_id: 'a', amount_paise, description });

describe('recents', () => {
  it('lists each recent category once, newest first, spends only', () => {
    const list = [s('food', 100), s('fuel', 200), s('food', 300), s(null, 50, null, 'credit'), s('rent', 900), s('gym', 10), s('bus', 5), s('tea', 5)];
    expect(recentCategories(list, 4)).toEqual(['food', 'fuel', 'rent', 'gym']);
  });

  it('keeps distinct category, amount and note once each', () => {
    const list = [s('food', 100, 'lunch'), s('food', 100, 'lunch'), s('food', 100, 'dinner'), s('fuel', 100, 'lunch'), s('rent', 5, null, 'transfer')];
    const r = repeatables(list, 3);
    expect(r.map(x => `${x.categoryId}:${x.description}`)).toEqual(['food:lunch', 'food:dinner', 'fuel:lunch']);
  });

  it('is empty without spends', () => {
    expect(recentCategories([])).toEqual([]);
    expect(repeatables([])).toEqual([]);
  });
});
