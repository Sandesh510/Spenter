import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth } from '../lib/dates';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, HomeData, Profile } from '../lib/types';

const SHOW_FIRST = 5;

/**
 * Settings, per screens/ScreenSettings.dc.html.
 * Biometric unlock is shown as in the mockup but is not available on the web.
 */
export function Settings({
  token,
  onToast,
  profile,
  onProfile,
  onSignOut,
  email,
}: {
  token: string;
  onToast: (m: string) => void;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onSignOut: () => void;
  email: string | undefined;
}) {
  const month = currentMonth();
  const home = useApi<HomeData>(`home?month=${month}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function savePlan(categoryId: string) {
    setError(null);
    try {
      await api('budgets', { token, body: { categoryId, month, amount: draft.trim() || '0' } });
      setEditing(null);
      home.reload();
      onToast('Budget saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function setTheme(theme: 'dark' | 'light') {
    try {
      await api('profile', { method: 'PATCH', token, body: { theme } });
      document.documentElement.dataset.theme = theme;
      onProfile({ ...profile, theme });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change theme');
    }
  }

  const cats = home.data?.categories ?? [];
  const shown = showAll ? cats : cats.slice(0, SHOW_FIRST);

  return (
    <div className="scroll">
      <h1 className="heading" style={{ fontSize: 24, margin: '8px 0 0' }}>Settings</h1>
      {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}

      <SectionTitle>Budgets &amp; categories</SectionTitle>
      <Group>
        {shown.map(c => (
          <div key={c.id} style={{ borderBottom: '1px solid var(--line)' }}>
            <button
              onClick={() => { setEditing(c.id); setDraft(c.plannedPaise ? String(c.plannedPaise / 100) : ''); }}
              style={rowButton}
            >
              <span style={{ width: 9, height: 9, borderRadius: 3, flex: 'none', background: c.bucket === 'need' ? 'var(--need)' : c.bucket === 'want' ? 'var(--amber)' : 'var(--green)' }} />
              <span style={{ flex: 1, fontSize: 13.5 }}>{c.name}</span>
              <span style={{ fontSize: 10, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{BUCKET_LABEL[c.bucket]}</span>
              <span className="num" style={{ fontSize: 13, minWidth: 64, textAlign: 'right' }}>{c.plannedPaise ? formatINR(c.plannedPaise) : '—'}</span>
            </button>
            {editing === c.id && (
              <form
                onSubmit={(e: FormEvent) => { e.preventDefault(); savePlan(c.id); }}
                style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}
              >
                <input className="input num" inputMode="decimal" placeholder="Monthly plan, e.g. 5000 (0 clears)" value={draft} onChange={e => setDraft(e.target.value)} style={{ fontSize: 15 }} autoFocus />
                <button className="btn" type="submit" style={{ padding: '8px 12px' }}>Save</button>
              </form>
            )}
          </div>
        ))}
        {cats.length > SHOW_FIRST && (
          <button onClick={() => setShowAll(s => !s)} style={{ ...rowButton, justifyContent: 'center', color: 'var(--amber)', fontSize: 12.5 }}>
            {showAll ? 'Show fewer' : `Show all ${cats.length} categories`}
          </button>
        )}
      </Group>

      <SectionTitle>Starting balance</SectionTitle>
      <StartingBalance token={token} month={month} onSaved={() => { home.reload(); onToast('Starting balance saved'); }} />

      <SectionTitle>Accounts</SectionTitle>
      <Group>
        {(accounts.data?.items ?? []).map(a => (
          <AccountRow key={a.id} a={a} token={token} onChanged={accounts.reload} onError={setError} />
        ))}
        <AddAccount token={token} count={accounts.data?.items.length ?? 0} onAdded={accounts.reload} onError={setError} />
      </Group>

      <SectionTitle>Security</SectionTitle>
      <Group>
        <PasscodeRow token={token} profile={profile} onProfile={onProfile} onToast={onToast} onError={setError} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
          <span style={{ color: 'var(--muted)' }}><Icon name="scan-face" size={17} /></span>
          <span style={{ flex: 1, fontSize: 13.5 }}>Biometric unlock</span>
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>Not on web</span>
        </div>
      </Group>

      <SectionTitle>Account</SectionTitle>
      <Group>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
          <span style={{ flex: 1, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email ?? 'Signed in'}</span>
          <button className="link" onClick={onSignOut} style={{ padding: 0 }}>Sign out</button>
        </div>
      </Group>

      <SectionTitle>Appearance</SectionTitle>
      <Group>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--muted)' }}><Icon name="moon" size={17} /></span>
          <span style={{ flex: 1, fontSize: 13.5 }}>Theme</span>
          <span style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                aria-pressed={profile.theme === t}
                style={{ padding: '5px 11px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: profile.theme === t ? 'var(--amber)' : 'transparent', color: profile.theme === t ? 'var(--on-amber)' : 'var(--muted)', textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
          <span style={{ color: 'var(--muted)' }}><Icon name="indian-rupee" size={17} /></span>
          <span style={{ flex: 1, fontSize: 13.5 }}>Currency</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>₹ INR</span>
        </div>
      </Group>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '22px 2px 10px' }}>
      <span className="kicker">{children}</span>
      {action}
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: 14 }}>{children}</div>;
}

const rowButton = { display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '12px 14px', background: 'none', border: 'none', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' } as const;

function StartingBalance({ token, month, onSaved }: { token: string; month: string; onSaved: () => void }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('month-opening', { token, body: { month, amount } });
      setAmount('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Group>
      <form onSubmit={save} style={{ display: 'flex', gap: 8, padding: 12 }}>
        <input className="input num" inputMode="decimal" placeholder="Amount for this month, e.g. 92400" value={amount} onChange={e => setAmount(e.target.value)} required style={{ fontSize: 15 }} aria-label="Starting balance" />
        <button className="btn" type="submit" disabled={busy} style={{ padding: '8px 12px' }}>{busy ? '…' : 'Save'}</button>
      </form>
      {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 12.5, margin: '0 14px 12px' }}>{error}</p>}
    </Group>
  );
}

function AccountRow({ a, token, onChanged, onError }: { a: Account; token: string; onChanged: () => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(a.nickname);

  async function rename(e: FormEvent) {
    e.preventDefault();
    try {
      await api('accounts', { method: 'PATCH', token, body: { id: a.id, nickname: name } });
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not rename');
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <button onClick={() => setEditing(e => !e)} style={rowButton}>
        <span style={{ width: 34, height: 34, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'var(--surface2)', color: 'var(--muted)' }}>
          <Icon name={a.icon ?? 'wallet'} size={16} />
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13.5 }}>{a.nickname}</span>
          {(a.bank || a.kind) && <span style={{ display: 'block', fontSize: 11, color: 'var(--faint)' }}>{[a.bank, a.kind].filter(Boolean).join(' · ')}</span>}
        </span>
        <span style={{ color: 'var(--faint)' }}><Icon name="pencil-line" size={15} /></span>
      </button>
      {editing && (
        <form onSubmit={rename} style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}>
          <input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={40} style={{ fontSize: 15 }} aria-label="Account name" />
          <button className="btn" type="submit" style={{ padding: '8px 12px' }}>Save</button>
        </form>
      )}
    </div>
  );
}

function AddAccount({ token, count, onAdded, onError }: { token: string; count: number; onAdded: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bank, setBank] = useState('');

  if (count >= 6) return <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--faint)' }}>Up to 6 accounts</div>;
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ ...rowButton, color: 'var(--amber)', fontSize: 12.5, justifyContent: 'center' }}>+ Add account</button>
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api('accounts', { token, body: { nickname, bank: bank || undefined } });
      setNickname('');
      setBank('');
      setOpen(false);
      onAdded();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add account');
    }
  }

  return (
    <form onSubmit={add} style={{ display: 'grid', gap: 8, padding: 12 }}>
      <input className="input" placeholder="Nickname, e.g. HDFC Salary" value={nickname} onChange={e => setNickname(e.target.value)} required maxLength={40} style={{ fontSize: 15 }} />
      <input className="input" placeholder="Bank (optional)" value={bank} onChange={e => setBank(e.target.value)} maxLength={60} style={{ fontSize: 15 }} />
      <button className="btn" type="submit">Add account</button>
    </form>
  );
}

function PasscodeRow({ token, profile, onProfile, onToast, onError }: { token: string; profile: Profile; onProfile: (p: Profile) => void; onToast: (m: string) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<'idle' | 'set' | 'off'>('idle');
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');

  async function setPasscode(e: FormEvent) {
    e.preventDefault();
    if (pin !== confirm) return onError('The two passcodes do not match');
    try {
      await api('profile', { method: 'PATCH', token, body: { pin } });
      onProfile({ ...profile, lockEnabled: true });
      setMode('idle');
      setPin('');
      setConfirm('');
      onToast('Passcode set');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not set passcode');
    }
  }

  async function turnOff() {
    try {
      await api('profile', { method: 'PATCH', token, body: { clearPin: true } });
      onProfile({ ...profile, lockEnabled: false });
      setMode('idle');
      onToast('Passcode turned off');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not turn off passcode');
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
        <span style={{ color: 'var(--muted)' }}><Icon name="lock-keyhole" size={17} /></span>
        <span style={{ flex: 1, fontSize: 13.5 }}>App passcode</span>
        <button className="link" onClick={() => setMode(mode === 'set' ? 'idle' : 'set')} style={{ padding: 0 }}>
          {profile.lockEnabled ? 'Change' : 'Set'}
        </button>
        {profile.lockEnabled && <button className="link" onClick={() => setMode(mode === 'off' ? 'idle' : 'off')} style={{ padding: 0, color: 'var(--muted)' }}>Turn off</button>}
      </div>
      {mode === 'set' && (
        <form onSubmit={setPasscode} style={{ display: 'grid', gap: 8, padding: '0 14px 12px' }}>
          <input className="input num" inputMode="numeric" maxLength={4} placeholder="New 4-digit passcode" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required style={{ fontSize: 15 }} />
          <input className="input num" inputMode="numeric" maxLength={4} placeholder="Repeat passcode" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} required style={{ fontSize: 15 }} />
          <button className="btn" type="submit">Save passcode</button>
        </form>
      )}
      {mode === 'off' && (
        <div style={{ display: 'flex', gap: 10, padding: '0 14px 12px', alignItems: 'center' }}>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--muted)' }}>Turn off the passcode lock?</span>
          <button className="btn" onClick={turnOff} style={{ padding: '8px 12px' }}>Turn off</button>
        </div>
      )}
    </div>
  );
}
