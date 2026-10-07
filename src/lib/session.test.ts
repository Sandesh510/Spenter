import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { accessToken, readSession, refreshAfterRejection, writeSession } from './session';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

const nowSec = () => Math.floor(Date.now() / 1000);
const fresh = { access_token: 'a1', refresh_token: 'r1', expires_at: nowSec() + 3600 };
const expiring = { access_token: 'a1', refresh_token: 'r1', expires_at: nowSec() + 30 };

function respond(status: number, body: unknown) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('session renewal', () => {
  it('uses a token that is not about to expire without refreshing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    writeSession(fresh);
    expect(await accessToken()).toBe('a1');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes once when the token is about to expire, even for parallel requests', async () => {
    const fetchMock = vi.fn(() => respond(200, { access_token: 'a2', refresh_token: 'r2', expires_at: nowSec() + 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    writeSession(expiring);
    const [x, y] = await Promise.all([accessToken(), accessToken()]);
    expect(x).toBe('a2');
    expect(y).toBe('a2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readSession()?.refresh_token).toBe('r2');
  });

  it('signs out only when the refresh token is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(() => respond(401, { error: 'Session ended. Please sign in again.' })));
    writeSession(expiring);
    await expect(accessToken()).rejects.toMatchObject({ status: 401 });
    expect(readSession()).toBeNull();
  });

  it('keeps the session when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
    writeSession(expiring);
    await expect(accessToken()).rejects.toMatchObject({ status: 0 });
    expect(readSession()?.refresh_token).toBe('r1');
  });

  it('after a 401, uses a newer token another request already saved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    writeSession({ ...fresh, access_token: 'a3' });
    expect(await refreshAfterRejection('a1')).toBe('a3');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('after a 401 with nothing saved, there is nothing to refresh', async () => {
    expect(await refreshAfterRejection('a1')).toBeNull();
  });
});
