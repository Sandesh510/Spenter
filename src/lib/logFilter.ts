/**
 * The Log's filters, kept for the length of the browser tab so a reload does not clear them.
 * They come back only after a reload (or back/forward), and only once: opening the Log from the tab bar
 * later starts with no filter, as before.
 */
export interface SavedLogFilter {
  month: string;
  categoryId: string;
  bucket: string;
  accountId: string;
}

const KEY = 'spendcheck.logFilter.v1';

/** Reads a saved filter, ignoring anything that is not the right shape. */
export function parseSaved(raw: string | null): SavedLogFilter | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedLogFilter>;
    if (typeof v.month !== 'string' || !/^\d{4}-\d{2}$/.test(v.month)) return null;
    const text = (x: unknown) => (typeof x === 'string' && x.length <= 60 ? x : '');
    const bucket = v.bucket === 'need' || v.bucket === 'want' || v.bucket === 'save' ? v.bucket : '';
    return { month: v.month, categoryId: text(v.categoryId), bucket, accountId: text(v.accountId) };
  } catch {
    return null;
  }
}

export function saveLogFilter(f: SavedLogFilter): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    /* storage unavailable: the filter is simply not kept */
  }
}

function pageWasReloaded(): boolean {
  try {
    const type = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type;
    return type === 'reload' || type === 'back_forward';
  } catch {
    return false;
  }
}

let restorable = pageWasReloaded();

/** Called once the Log has started with the saved filter, so later visits to the Log start unfiltered. */
export function releaseSavedLogFilter(): void {
  restorable = false;
}

/**
 * The filter saved before a reload. Returns the same value until releaseSavedLogFilter() is called, because
 * React may run a state initializer twice in development. Null when the page was not reloaded.
 */
export function takeSavedLogFilter(): SavedLogFilter | null {
  if (!restorable) return null;
  try {
    return parseSaved(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
