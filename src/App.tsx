import { Button } from './components/ui/Button';
import { Input } from './components/ui/Field';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Icon } from './components/Icon';
import { IDLE_LOCK_MS, isStillActive, touchActive, getLastActive } from './lib/prefs';
import { api, ApiError } from './lib/api';
import { cache, isStale, refreshAll, restoreSnapshot, type Bootstrap, type User } from './lib/cache';
import type { Profile, TxnRow } from './lib/types';
import { Ask } from './screens/Ask';
import { Home } from './screens/Home';
import { Lent } from './screens/Lent';
import { Commitments } from './screens/Commitments';
import { Lock } from './screens/Lock';
import { Log } from './screens/Log';
import { Manual } from './screens/Manual';
import { QuickAdd } from './screens/QuickAdd';
import { Settings } from './screens/Settings';
import { Trends } from './screens/Trends';

export type Route = Tab | 'ask' | 'quickadd' | 'manual' | 'lent' | 'commitments';

const ROUTE_NAMES: readonly string[] = ['home', 'log', 'trends', 'settings', 'ask', 'quickadd', 'manual', 'lent', 'commitments'];
function isRoute(v: unknown): v is Route {
  return typeof v === 'string' && ROUTE_NAMES.includes(v);
}

/** The screen to show on load: the one this history entry was on, so a refresh keeps the current screen. */
function initialRoute(): Route {
  const r: unknown = window.history.state?.route;
  return isRoute(r) ? r : 'home';
}


const TOKEN_KEY = 'spendcheck.accessToken';
const NAV_TABS: Tab[] = ['home', 'log', 'trends', 'settings'];

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the user signs in again next visit */
  }
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [route, setRoute] = useState<Route>(initialRoute);
  // Mirrors `route` for event handlers, which would otherwise see a stale value.
  const routeRef = useRef<Route>(route);
  const [editTxn, setEditTxn] = useState<TxnRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Startup: paint the last snapshot at once, then refresh everything in one request.
  // Only a rejected session (401) signs the user out; a network failure keeps the cached data.
  // Browser and Android back: move to the screen that history entry was on, without reloading.
  useEffect(() => {
    if (!window.history.state?.route) window.history.replaceState({ route: routeRef.current }, '');
    const onPop = (e: PopStateEvent) => {
      const r: unknown = e.state?.route;
      const next: Route = isRoute(r) ? r : 'home';
      if (next !== 'manual') setEditTxn(null);
      routeRef.current = next;
      setRoute(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const stored = readToken();
    if (!stored) return setChecking(false);
    const snap = restoreSnapshot();
    if (snap) {
      setToken(stored);
      setUser(snap.user);
      setProfile(snap.profile);
      setUnlocked(!snap.profile.lockEnabled || isStillActive());
      setChecking(false);
    }
    refreshAll(stored)
      .then(boot => applyBoot(stored, boot))
      .catch(err => {
        if (err instanceof ApiError && err.status === 401) signOutLocally();
      })
      .finally(() => setChecking(false));
  }, []);

  // Keep data fresh when the phone app comes back to the foreground.
  useEffect(() => {
    if (!token) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isStale()) refreshAll(token).then(boot => applyBoot(token, boot)).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [token]);

  // Idle lock: while unlocked, record activity and lock after IDLE_LOCK_MS without any interaction.
  // A refresh or reopen keeps the session if the user was active within that window.
  useEffect(() => {
    if (!token || !profile?.lockEnabled || !unlocked) return;
    let lastWrite = 0;
    const mark = () => {
      const now = Date.now();
      if (now - lastWrite > 15_000) {
        lastWrite = now;
        touchActive();
      }
    };
    const checkIdle = () => {
      if (Date.now() - getLastActive() >= IDLE_LOCK_MS) setUnlocked(false);
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
    for (const e of events) window.addEventListener(e, mark, { passive: true });
    const timer = window.setInterval(checkIdle, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkIdle();
    };
    document.addEventListener('visibilitychange', onVisible);
    mark();
    return () => {
      for (const e of events) window.removeEventListener(e, mark);
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token, profile?.lockEnabled, unlocked]);

  // Theme is applied whenever the profile changes.
  useEffect(() => {
    if (profile) document.documentElement.dataset.theme = profile.theme;
  }, [profile]);

  // Show a message for ~2.3s, as the mockups' toast does.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2300);
    return () => window.clearTimeout(t);
  }, [toast]);

  function applyBoot(t: string, boot: Bootstrap) {
    setToken(t);
    setUser(boot.user);
    setProfile(boot.data.profile);
    setUnlocked(prev => prev || !boot.data.profile.lockEnabled || isStillActive());
  }

  function signedIn(t: string, u: User) {
    writeToken(t);
    setToken(t);
    setUser(u);
    routeRef.current = 'home';
    setRoute('home');
    refreshAll(t)
      .then(boot => applyBoot(t, boot))
      .catch(() => setUnlocked(true))
      .finally(() => touchActive());
  }

  function signOutLocally() {
    cache.clear();
    writeToken(null);
    setToken(null);
    setUser(null);
    setProfile(null);
    setUnlocked(false);
  }

  if (checking) return <Frame><p className="c-sec" style={{ padding: 24 }}>Loading…</p></Frame>;
  if (!user || !token) return <SignIn onSignedIn={signedIn} />;
  if (profile?.lockEnabled && !unlocked) {
    return (
      <Frame>
        <Lock token={token} onUnlock={() => { touchActive(); setUnlocked(true); }} />
      </Frame>
    );
  }

  const tab: Tab | null = NAV_TABS.includes(route as Tab) ? (route as Tab) : null;
  // The edit target only lives while the edit form is open.
  // Each screen is a history entry, so the browser and Android back buttons move between screens
  // inside the app instead of leaving the page.
  const go = (r: Route) => {
    if (r !== 'manual') setEditTxn(null);
    if (r !== routeRef.current) window.history.pushState({ route: r }, '');
    routeRef.current = r;
    setRoute(r);
  };
  const edit = (t: TxnRow) => {
    setEditTxn(t);
    go('manual');
  };
  const showToast = (m: string) => setToast(m);

  return (
    <Frame>
      {route === 'home' && <Home token={token} go={go} />}
      {route === 'log' && <Log token={token} go={go} onEdit={edit} />}
      {route === 'ask' && <Ask token={token} go={go} onToast={showToast} />}
      {route === 'trends' && <Trends token={token} />}
      {route === 'settings' && profile && (
        <Settings token={token} onToast={showToast} profile={profile} onProfile={setProfile} onSignOut={signOutLocally} onLockNow={() => { setUnlocked(false); }} email={user.email} />
      )}
      {route === 'quickadd' && <QuickAdd token={token} go={go} onToast={showToast} />}
      {route === 'manual' && <Manual token={token} go={go} onToast={showToast} editing={editTxn} />}
      {route === 'lent' && <Lent token={token} go={go} onToast={showToast} />}
      {route === 'commitments' && <Commitments token={token} go={go} onToast={showToast} />}

      {tab && <BottomNav active={tab} onGo={go} onAdd={() => go('quickadd')} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </Frame>
  );
}

/** Phone-width frame from the mockups. Fills the screen on a phone, capped at 420px on desktop. */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="phone">{children}</div>;
}

function SignIn({ onSignedIn }: { onSignedIn: (token: string, user: User) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const body = { email: email.trim(), password };
      if (mode === 'signup') {
        const res = await api<{ needsConfirmation: boolean }>('auth-signup', { body });
        setNotice(res.needsConfirmation ? 'Account created. Confirm your email, then sign in.' : 'Account created. Sign in to continue.');
        setMode('login');
        setPassword('');
      } else {
        const res = await api<{ access_token: string; user: User }>('auth-login', { body });
        onSignedIn(res.access_token, res.user);
      }
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="phone" style={{ padding: '56px 24px 24px' }}>
      <div className="ta-c" style={{ marginBottom: 28 }}>
        <div className="grid c-accent" style={{ width: 60, height: 60, borderRadius: 18, border: '1px solid var(--color-accent)', placeItems: 'center', margin: '0 auto' }}>
          <Icon name="wallet" size={26} />
        </div>
        <div className="heading fs-24 mt-14">SpendCheck</div>
        <div className="fs-13 c-sec mt-4">{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</div>
      </div>

      <form className="grid gap-12" onSubmit={submit} >
        <Input  type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <Input
          
          type="password"
          placeholder={mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={mode === 'signup' ? 8 : undefined}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
        <Button className="mt-6" type="submit" disabled={busy} >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>
      </form>

      {error && <p className="c-danger fs-13" role="alert">{error}</p>}
      {notice && <p className="c-success fs-13">{notice}</p>}

      <button
        className="link"
        style={{ display: 'block', margin: '18px auto 0' }}
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setNotice(null); }}
      >
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </div>
  );
}
