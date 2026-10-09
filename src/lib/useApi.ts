import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from './api';
import { cache, refreshAll, refreshFailed } from './cache';

/**
 * Reads a cached endpoint. Data comes from the bootstrap cache when present, so screens render at once.
 * A key not in the cache is fetched on its own. reload() refreshes everything in one request and
 * marks other keys stale, so screens showing them fetch fresh data.
 */
export function useApi<T>(path: string | null, token: string) {
  const data = useSyncExternalStore(
    cache.subscribe,
    () => (path ? (cache.get(path) as T | undefined) : undefined),
    () => undefined,
  );
  const version = useSyncExternalStore(cache.subscribe, cache.version, cache.version);
  const [error, setError] = useState<string | null>(null);

  // Fetch a key bootstrap does not carry, and fetch it again after a change marks it stale.
  useEffect(() => {
    if (!path || !cache.needsFetch(path)) return;
    let cancelled = false;
    api<T>(path, { token })
      .then(d => {
        if (!cancelled) cache.set(path, d);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load');
      });
    return () => {
      cancelled = true;
    };
  }, [path, token, version]);

  const reload = useCallback(() => {
    setError(null);
    refreshAll(token).catch(err => setError(err instanceof Error ? err.message : 'Could not refresh'));
  }, [token]);

  return { data: data ?? null, error, reload };
}

/** True when totals on screen may be old because a refresh after a save failed. */
export function useRefreshFailed(): boolean {
  return useSyncExternalStore(cache.subscribe, refreshFailed, () => false);
}
