import { api } from './api';
import type { Profile } from './types';

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
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export const cache = {
  get: (key: string): unknown => data[key],
  has: (key: string): boolean => key in data,
  set(key: string, value: unknown) {
    data = { ...data, [key]: value };
    emit();
  },
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
