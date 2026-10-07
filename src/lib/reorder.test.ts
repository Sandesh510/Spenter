import { describe, expect, it } from 'vitest';
import { reorder } from './reorder';

const rows = [
  { id: 'a', sort_order: 0 },
  { id: 'b', sort_order: 1 },
  { id: 'c', sort_order: 2 },
];

describe('reorder', () => {
  it('swaps with the neighbour and returns only the two rows that changed', () => {
    expect(reorder(rows, 'b', 'up')).toEqual([{ id: 'b', sort_order: 0 }, { id: 'a', sort_order: 1 }]);
    expect(reorder(rows, 'b', 'down')).toEqual([{ id: 'c', sort_order: 1 }, { id: 'b', sort_order: 2 }]);
  });

  it('changes nothing at the ends', () => {
    expect(reorder(rows, 'a', 'up')).toEqual([]);
    expect(reorder(rows, 'c', 'down')).toEqual([]);
  });

  it('clears gaps and duplicates from older data', () => {
    const messy = [{ id: 'a', sort_order: 0 }, { id: 'b', sort_order: 0 }, { id: 'c', sort_order: 5 }];
    expect(reorder(messy, 'a', 'up')).toEqual([{ id: 'b', sort_order: 1 }, { id: 'c', sort_order: 2 }]);
  });

  it('returns null for an unknown id', () => {
    expect(reorder(rows, 'zzz', 'up')).toBeNull();
  });
});
