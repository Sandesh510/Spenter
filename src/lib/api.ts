/** Thin wrapper over the Netlify Functions. The browser never holds a Supabase key. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export async function api<T = unknown>(
  path: string,
  opts: { method?: Method; body?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

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
  } catch (err) {
    if (controller.signal.aborted) throw new ApiError(504, 'The server took too long to answer. Check your connection and try again.');
    throw new ApiError(0, 'Could not reach the server. Is it running?');
  } finally {
    window.clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}
