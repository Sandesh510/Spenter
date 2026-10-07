/** Thin wrapper over the Netlify Functions. The browser never holds a Supabase key. */
import { accessToken, refreshAfterRejection } from './session';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type Opts = { method?: Method; body?: unknown; token?: string };

/**
 * Calls a Netlify Function. A signed-in call (one given a token) uses the device's current session:
 * the access token is renewed shortly before it expires, and a 401 is retried once after a refresh,
 * so an open or installed app stays signed in. Only a session that cannot be renewed fails with 401.
 */
export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  if (!opts.token) return send<T>(path, opts, undefined);
  const token = (await accessToken()) ?? opts.token;
  try {
    return await send<T>(path, opts, token);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    const renewed = await refreshAfterRejection(token);
    if (!renewed || renewed === token) throw err;
    return send<T>(path, opts, renewed);
  }
}

async function send<T>(path: string, opts: Opts, token: string | undefined): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  // A request that never answers would leave a screen on "Loading…" forever, so give up after 15s.
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(`/.netlify/functions/${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) throw new ApiError(504, 'The server took too long to answer. Check your connection and try again.');
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  } finally {
    window.clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
