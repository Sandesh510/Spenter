/**
 * Moves one id a place up or down in an ordered list, and returns only the rows whose position changed.
 * Positions are rewritten from 0, so gaps and duplicates in older data are cleared. Null when the id is not in the list.
 */
export function reorder(
  rows: { id: string; sort_order: number }[],
  id: string,
  direction: 'up' | 'down',
): { id: string; sort_order: number }[] | null {
  const ids = rows.map(r => r.id);
  const i = ids.indexOf(id);
  if (i < 0) return null;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]];
  const before = new Map(rows.map(r => [r.id, r.sort_order]));
  return ids.map((catId, position) => ({ id: catId, sort_order: position })).filter(r => before.get(r.id) !== r.sort_order);
}
