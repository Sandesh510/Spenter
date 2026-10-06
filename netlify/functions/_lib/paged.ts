import { HttpError } from './response';

/** Rows per request. PostgREST caps a response (1000 by default), so longer reads go page by page. */
const PAGE = 1000;

/**
 * Reads every row of a query, a page at a time. `page` must build the same ordered query each call
 * (order by a unique key last, so pages never overlap) and apply `.range(from, to)`.
 * Refuses rather than returning a partial result past `maxRows`, since totals from part of the rows would be wrong.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  maxRows = 50_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    if (from >= maxRows) throw new HttpError(413, 'Too many entries to read at once');
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
