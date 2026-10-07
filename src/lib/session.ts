import { ApiError } from './api';

/**
 * The signed-in session, kept on this device. Supabase access tokens last about an hour, so the
 * refresh token is kept too and swapped for a new pair shortly before the access token runs out.
 * Without this the installed app signed the user out (or failed every save) an hour after sign-in.
 */
export interface Session {
  access_token: string;
  refresh_token: string;
  /** Unix seconds when the access token expires. */
  expires_at: number;
}

const KEY = 'spendcheck.session.v1';
/** Sessions saved before refresh tokens were kept: an access token only. */
const LEGACY_KEY = 'spendcheck.accessToken';
/** Refresh this long before expiry, so a request never leaves with a token about to run out. */
const EARLY_MS = 120_000;

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    return s.access_token && s.refresh_token && typeof s.expires_at === 'number' ? (s as Session) : null;
  } catch {
    return null;
  }
}

export function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at }));
    else localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* storage unavailable: the user signs in again next visit */
  }
}

function readLegacyToken(): string | null {
  try {
    return localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

/** True when there is anything to sign in with on this device. */
export function hasSession(): boolean {
  return readSession() !== null || readLegacyToken() !== null;
}

const expiresSoon = (s: Session) => s.expires_at * 1000 - Date.now() < EARLY_MS;

let inflight: Promise<Session> | null = null;

/**
 * Swaps the refresh token for a new session. One refresh at a time: Supabase rotates refresh tokens,
 * so two parallel refreshes with the same token would end the session.
 * A rejected refresh token signs the user out (401); a network failure keeps the session (status 0).
 */
function refresh(current: Session): Promise<Session> {
  if (inflight) return inflight;
  inflight = (async () => {
    // Another tab may already have refreshed and saved a newer session.
    const stored = readSession();
    if (stored && stored.refresh_token !== current.refresh_token && !expiresSoon(stored)) return stored;
    const from = stored ?? current;

    let res: Response;
    try {
      res = await fetch('/.netlify/functions/auth-refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: from.refresh_token }),
      });
    } catch {
      throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
    }
    const data = (await res.json().catch(() => ({}))) as Partial<Session> & { error?: string };
    if (!res.ok || !data.access_token || !data.refresh_token || typeof data.expires_at !== 'number') {
      if (res.status === 400 || res.status === 401) {
        writeSession(null);
        throw new ApiError(401, data.error ?? 'Session ended. Please sign in again.');
      }
      throw new ApiError(res.status, data.error ?? 'Could not refresh the session');
    }
    const next: Session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
    writeSession(next);
    return next;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** A usable access token, refreshed first when it is about to expire. Null when signed out. */
export async function accessToken(): Promise<string | null> {
  const s = readSession();
  if (!s) return readLegacyToken();
  if (!expiresSoon(s)) return s.access_token;
  return (await refresh(s)).access_token;
}

/** After a 401: try one refresh. Returns the new token, or null when there is nothing to refresh with. */
export async function refreshAfterRejection(rejected: string): Promise<string | null> {
  const s = readSession();
  if (!s) return null;
  // A newer token was saved since this request left (another request already refreshed).
  if (s.access_token !== rejected && !expiresSoon(s)) return s.access_token;
  return (await refresh(s)).access_token;
}
