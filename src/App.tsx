import { useEffect, useState, type FormEvent } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { Icon } from './components/Icon';
import { api, ApiError } from './lib/api';
import { cache, isStale, refreshAll, restoreSnapshot, type Bootstrap, type User } from './lib/cache';
import type { Profile } from './lib/types';
import { Ask } from './screens/Ask';
import { Home } from './screens/Home';
import { Lent } from './screens/Lent';
import { Lock } from './screens/Lock';
import { Log } from './screens/Log';
import { Manual } from './screens/Manual';
import { QuickAdd } from './screens/QuickAdd';
import { Settings } from './screens/Settings';
import { Trends } from './screens/Trends';

export type Route = Tab | 'quickadd' | 'manual' | 'lent';


const TOKEN_KEY = 'spendcheck.accessToken';
const NAV_TABS: Tab[] = ['home', 'log', 'ask', 'trends', 'settings'];

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
  const [route, setRoute] = useState<Route>('home');
  const [toast, setToast] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Startup: paint the last snapshot at once, then refresh everything in one request.
  // Only a rejected session (401) signs the user out; a network failure keeps the cached data.
  useEffect(() => {
    const stored = readToken();
    if (!stored) return setChecking(false);
    const snap = restoreSnapshot();
    if (snap) {
      setToken(stored);
      setUser(snap.user);
      setProfile(snap.profile);
      setUnlocked(!snap.profile.lockEnabled);
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
    setUnlocked(prev => prev || !boot.data.profile.lockEnabled);
  }

  function signedIn(t: string, u: User) {
    writeToken(t);
    setToken(t);
    setUser(u);
    setRoute('home');
    refreshAll(t)
      .then(boot => applyBoot(t, boot))
      .catch(() => setUnlocked(true));
  }

  function signOutLocally() {
    cache.clear();
    writeToken(null);
    setToken(null);
    setUser(null);
    setProfile(null);
    setUnlocked(false);
  }

  if (checking) return <Frame><p style={{ padding: 24, color: 'var(--muted)' }}>Loading…</p></Frame>;
  if (!user || !token) return <SignIn onSignedIn={signedIn} />;
  if (profile?.lockEnabled && !unlocked) {
    return (
      <Frame>
        <Lock token={token} onUnlock={() => setUnlocked(true)} />
      </Frame>
    );
  }

  const tab: Tab | null = NAV_TABS.includes(route as Tab) ? (route as Tab) : null;
  const go = (r: Route) => setRoute(r);
  const showToast = (m: string) => setToast(m);

  return (
    <Frame>
      {route === 'home' && <Home token={token} go={go} />}
      {route === 'log' && <Log token={token} go={go} />}
      {route === 'ask' && <Ask token={token} go={go} onToast={showToast} />}
      {route === 'trends' && <Trends token={token} />}
      {route === 'settings' && profile && (
        <Settings token={token} onToast={showToast} profile={profile} onProfile={setProfile} onSignOut={signOutLocally} email={user.email} />
      )}
      {route === 'quickadd' && <QuickAdd token={token} go={go} onToast={showToast} />}
      {route === 'manual' && <Manual token={token} go={go} onToast={showToast} />}
      {route === 'lent' && <Lent token={token} go={go} onToast={showToast} />}

      {tab && <BottomNav active={tab} onGo={go} />}
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
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, border: '1px solid var(--amber)', display: 'grid', placeItems: 'center', color: 'var(--amber)', margin: '0 auto' }}>
          <Icon name="wallet" size={26} />
        </div>
        <div className="heading" style={{ fontSize: 23, marginTop: 14 }}>SpendCheck</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</div>
      </div>

      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
        <input
          className="input"
          type="password"
          placeholder={mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={mode === 'signup' ? 8 : undefined}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
        />
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>

      {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
      {notice && <p style={{ color: 'var(--green)', fontSize: 13 }}>{notice}</p>}

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
