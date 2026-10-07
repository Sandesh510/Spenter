import { describe, expect, it } from 'vitest';
import { parseSaved } from './logFilter';

describe('parseSaved', () => {
  it('reads a saved filter', () => {
    expect(parseSaved(JSON.stringify({ month: '2026-10', categoryId: 'c1', bucket: 'want', accountId: '' }))).toEqual({
      month: '2026-10', categoryId: 'c1', bucket: 'want', accountId: '',
    });
  });
  it('drops an unknown budget and non-text ids', () => {
    expect(parseSaved(JSON.stringify({ month: '2026-10', categoryId: 5, bucket: 'other', accountId: null }))).toEqual({
      month: '2026-10', categoryId: '', bucket: '', accountId: '',
    });
  });
  it('ignores a missing, broken or wrongly shaped value', () => {
    expect(parseSaved(null)).toBeNull();
    expect(parseSaved('not json')).toBeNull();
    expect(parseSaved(JSON.stringify({ month: 'October' }))).toBeNull();
  });
});
