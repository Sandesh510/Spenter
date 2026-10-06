import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api } from './api';
import { cache, refreshAll } from './cache';

/**
 * Reads a cached endpoint. Data comes from the bootstrap cache when present, so screens render at once.
 * A key not in the cache is fetched on its own. reload() refreshes everything in one request.
 */
export function useApi<T>(path: string | null, token: string) {
  const data = useSyncExternalStore(
    cache.subscribe,
    () => (path ? (cache.get(path) as T | undefined) : undefined),
    () => undefined,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path || cache.has(path)) return;
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
  }, [path, token]);

  const reload = useCallback(() => {
    setError(null);
    refreshAll(token).catch(err => setError(err instanceof Error ? err.message : 'Could not refresh'));
  }, [token]);

  return { data: data ?? null, error, reload };
}
