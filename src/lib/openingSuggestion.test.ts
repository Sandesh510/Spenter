import { describe, expect, it } from 'vitest';
import { suggestOpening } from './openingSuggestion';

describe('suggestOpening', () => {
  it('suggests last month closing balance when it had a starting balance and money is left', () => {
    expect(suggestOpening({ hadOpening: true, closingPaise: 26_400_00 })).toBe(26_400_00);
  });
  it('suggests nothing when last month had no starting balance', () => {
    expect(suggestOpening({ hadOpening: false, closingPaise: 26_400_00 })).toBeNull();
  });
  it('suggests nothing when nothing, or less than nothing, is left', () => {
    expect(suggestOpening({ hadOpening: true, closingPaise: 0 })).toBeNull();
    expect(suggestOpening({ hadOpening: true, closingPaise: -5_00 })).toBeNull();
  });
});
