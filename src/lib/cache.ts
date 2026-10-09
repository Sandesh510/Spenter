import { api } from './api';
import type { Profile, TxnRow } from './types';

/**
 * In-memory cache for the signed-in app, filled by one `bootstrap` request.
 * Screens read from here, so moving between tabs does not wait on the network.
 * A copy is kept in localStorage so the app paints last-known data immediately on reopen.
 * This is a per-device convenience only; the server stays the source of truth.
 */

export interface User {
  id: string;
  email: string | undefined;
}

interface Snapshot {
  user: User;
  profile: Profile;
  data: Record<string, unknown>;
  savedAt: number;
}

const SNAPSHOT_KEY = 'spendcheck.snapshot.v1';
const FRESH_MS = 30_000;

let data: Record<string, unknown> = {};
let lastRefreshed = 0;
/** Keys whose data may be out of date. Their screens keep showing it while it is fetched again. */
const stale = new Set<string>();
/** Bumped when keys go stale, so mounted screens know to fetch again. */
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export const cache = {
  get: (key: string): unknown => data[key],
  has: (key: string): boolean => key in data,
  set(key: string, value: unknown) {
    data = { ...data, [key]: value };
    stale.delete(key);
    emit();
  },
  /** True when the key has no data yet, or its data went stale after a change. */
  needsFetch: (key: string): boolean => !(key in data) || stale.has(key),
  version: (): number => version,
  prime(values: Record<string, unknown>) {
    data = { ...data, ...values };
    emit();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  clear() {
    data = {};
    lastRefreshed = 0;
    try {
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch {
      /* storage unavailable */
    }
    emit();
  },
};

export function isStale(): boolean {
  return Date.now() - lastRefreshed > FRESH_MS;
}

export function readSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as Snapshot) : null;
  } catch {
    return null;
  }
}

function writeSnapshot(s: Snapshot) {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(s));
  } catch {
    /* quota or private mode: the app still works, just without the instant first paint */
  }
}

export interface Bootstrap {
  user: User;
  month: string;
  data: Record<string, unknown> & { profile: Profile };
}

/** Loads everything in one request, fills the cache, and saves a snapshot. */
export async function refreshAll(token: string): Promise<Bootstrap> {
  const boot = await api<Bootstrap>('bootstrap', { token });
  const { profile, ...rest } = boot.data;
  // Anything bootstrap does not carry (commitments, insurance, savings, older months) may have changed too.
  for (const key of Object.keys(data)) if (!(key in rest)) stale.add(key);
  version += 1;
  refreshFailedFlag = false;
  cache.prime(rest);
  lastRefreshed = Date.now();
  writeSnapshot({ user: boot.user, profile, data: rest, savedAt: lastRefreshed });
  return boot;
}

/** Restores the last snapshot into memory. Returns it, or null if none exists. */
export function restoreSnapshot(): Snapshot | null {
  const snap = readSnapshot();
  if (snap) {
    data = { ...data, ...snap.data };
    emit();
  }
  return snap;
}

let refreshFailedFlag = false;
function setRefreshFailed(v: boolean) {
  if (refreshFailedFlag === v) return;
  refreshFailedFlag = v;
  emit();
}
/** True when a refresh after a save failed twice, so the totals on screen may be old. */
export const refreshFailed = (): boolean => refreshFailedFlag;

let background: Promise<unknown> | null = null;
let again = false;

/**
 * Refreshes everything without making the caller wait: a save shows its result at once and the totals
 * catch up a moment later. Calls made while one is running are folded into one more refresh after it.
 */
export function refreshInBackground(token: string, retried = false): void {
  if (background) {
    again = true;
    return;
  }
  background = refreshAll(token)
    .catch(() => {
      // One quiet retry; after that the app says the totals may be out of date.
      if (!retried) window.setTimeout(() => refreshInBackground(token, true), 4000);
      else setRefreshFailed(true);
    })
    .finally(() => {
      background = null;
      if (again) {
        again = false;
        refreshInBackground(token);
      }
    });
}

/**
 * Puts a just-saved entry into the cached list for its month, newest first, so Log shows it before the
 * full refresh finishes. Months that are not cached are left alone: they load fresh when opened.
 */
export function addTransactionToCache(row: TxnRow): void {
  const key = `transactions?month=${row.txn_date.slice(0, 7)}`;
  const current = data[key] as { items: TxnRow[] } | undefined;
  if (!current || current.items.some(t => t.id === row.id)) return;
  const at = current.items.findIndex(t => t.txn_date <= row.txn_date);
  const items = [...current.items];
  items.splice(at === -1 ? items.length : at, 0, row);
  data = { ...data, [key]: { ...current, items } };
  emit();
}
