import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { cache } from '../lib/cache';
import { haptic } from '../lib/haptics';
import { getFontSize, getHaptics, setFontSize, setHaptics, type FontSize } from '../lib/prefs';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth } from '../lib/dates';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, HomeData, Profile } from '../lib/types';
import { MAX_ACCOUNTS } from '../lib/limits';
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABEL, isAccountKind, type AccountKind } from '../lib/accountTypes';
import { Field } from '../components/ui/Field';
import { CategoryTile } from '../components/ui/CategoryTile';
import { CategoryEditor } from './CategoryEditor';
import { categoryIcon } from '../lib/categories';
import type { Category } from '../lib/types';

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
  onLockNow,
  email,
  onOpenRules,
}: {
  token: string;
  onToast: (m: string) => void;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onSignOut: () => void;
  onLockNow: () => void;
  email: string | undefined;
  onOpenRules: () => void;
}) {
  const month = currentMonth();
  const home = useApi<HomeData>(`home?month=${month}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const [showAll, setShowAll] = useState(false);
  const [font, setFont] = useState<FontSize>(getFontSize);
  const [haptics, setHapticsOn] = useState(getHaptics);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** The category being added ('new') or edited. */
  const [editorFor, setEditorFor] = useState<Category | 'new' | null>(null);

  async function savePlan(categoryId: string) {
    setError(null);
    try {
      await api('budgets', { token, body: { categoryId, month, amount: draft.trim() || '0' } });
      setEditing(null);
      home.reload();
      haptic('success');
      onToast('Budget saved');
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    }
  }

  async function setDefaultAccount(defaultAccountId: string | null) {
    try {
      await api('profile', { method: 'PATCH', token, body: { defaultAccountId } });
      const next = { ...profile, defaultAccountId };
      onProfile(next);
      // Add screens read the default from the cached profile.
      cache.set('profile', { ...(cache.get('profile') as Profile | undefined), ...next });
      haptic('tap');
      onToast(defaultAccountId ? 'Default account set' : 'Default account cleared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set default account');
    }
  }

  async function setTheme(theme: 'dark' | 'light') {
    try {
      await api('profile', { method: 'PATCH', token, body: { theme } });
      document.documentElement.dataset.theme = theme;
      haptic('tap');
      onProfile({ ...profile, theme });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change theme');
    }
  }

  const cats = home.data?.categories ?? [];
  const shown = showAll ? cats : cats.slice(0, SHOW_FIRST);

  return (
    <div className="scroll">
      <h1 className="heading fs-24" style={{ margin: '8px 0 0' }}>Settings</h1>
      {error && <p className="c-danger fs-13" role="alert">{error}</p>}

      <SectionTitle>Budgets &amp; categories</SectionTitle>
      <Group>
        {shown.map(c => (
          <div key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <button
              onClick={() => { setEditing(c.id); setDraft(c.plannedPaise ? String(c.plannedPaise / 100) : ''); }}
              style={rowButton}
            >
              <CategoryTile icon={categoryIcon(c)} bucket={c.bucket} />
              <span className="flex-1 fs-14">{c.name}</span>
              <span className="fs-11 c-mut" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>{BUCKET_LABEL[c.bucket]}</span>
              <span className="num fs-13 ta-r" style={{ minWidth: 64 }}>{c.plannedPaise ? formatINR(c.plannedPaise) : '—'}</span>
            </button>
            {editing === c.id && (
              <form
                onSubmit={(e: FormEvent) => { e.preventDefault(); savePlan(c.id); }}
                style={{ display: 'flex', gap: 8, padding: '0 14px 12px' }}
              >
                <Input numeric inputMode="decimal" placeholder="Monthly plan, e.g. 5000 (0 clears)" value={draft} onChange={e => setDraft(e.target.value)} style={{ fontSize: 15 }} autoFocus />
                <Button type="submit" size="sm">Save</Button>
              </form>
            )}
            {editing === c.id && (
              <div style={{ padding: '0 14px 12px' }}>
                <button className="link" onClick={() => setEditorFor(c)}>Edit name, icon or bucket</button>
              </div>
            )}
          </div>
        ))}
        <button onClick={() => setEditorFor('new')} style={{ ...rowButton, color: 'var(--color-accent-text)', fontSize: 12.5, justifyContent: 'center', borderTop: '1px solid var(--color-border)' }}>
          + Add category
        </button>
        {cats.length > SHOW_FIRST && (
          <button onClick={() => setShowAll(s => !s)} style={{ ...rowButton, justifyContent: 'center', color: 'var(--color-accent-text)', fontSize: 12.5 }}>
            {showAll ? 'Show fewer' : `Show all ${cats.length} categories`}
          </button>
        )}
      </Group>

      {editorFor !== null && (
        <CategoryEditor
          token={token}
          category={editorFor === 'new' ? null : editorFor}
          others={cats.filter(c => c.id !== (editorFor === 'new' ? null : editorFor.id))}
          onClose={() => setEditorFor(null)}
          onSaved={msg => { home.reload(); onToast(msg); }}
        />
      )}

      <SectionTitle>Accounts</SectionTitle>
      <Group>
        {(accounts.data?.items ?? []).map(a => (
          <AccountRow key={a.id} a={a} token={token} onChanged={accounts.reload} onError={setError} />
        ))}
        <AddAccount token={token} count={accounts.data?.items.length ?? 0} onAdded={accounts.reload} onError={setError} />
      </Group>

      <SectionTitle>Security</SectionTitle>
      <Group>
        {profile.lockEnabled && (
          <button onClick={onLockNow} style={{ ...rowButton, borderBottom: '1px solid var(--color-border)' }}>
            <span className="c-sec"><Icon name="lock-keyhole" size={17} /></span>
            <span className="flex-1 fs-14">Lock now</span>
            <span className="fs-12 c-mut">passcode</span>
          </button>
        )}
        <PasscodeRow token={token} profile={profile} onProfile={onProfile} onToast={onToast} onError={setError} />
        <div className="flex ai-c gap-12" style={{ padding: '13px 14px' }}>
          <span className="c-sec"><Icon name="scan-face" size={17} /></span>
          <span className="flex-1 fs-14">Biometric unlock</span>
          <span className="fs-11 c-mut">Not on web</span>
        </div>
      </Group>

      <SectionTitle>Account</SectionTitle>
      <Group>
        <div className="flex ai-c gap-12" style={{ padding: '13px 14px' }}>
          <span className="flex-1 fs-14 ovh ellipsis">{email ?? 'Signed in'}</span>
          <button className="link" onClick={onSignOut} style={{ padding: 0 }}>Sign out</button>
        </div>
      </Group>

      <SectionTitle>Entries</SectionTitle>
      <Card variant="compact" as="section" aria-label="Default account">
        <fieldset className="fieldset-reset grid gap-6">
          <legend className="fs-14">Default account</legend>
          <p className="fs-12 c-sec m-0">Every new entry starts with this account. You can still change it on each entry.</p>
          <div className="chiprow mt-4" style={{ margin: 0, padding: 0 }}>
            {(accounts.data?.items ?? []).map(a => (
              <button
                type="button"
                key={a.id}
                aria-pressed={profile.defaultAccountId === a.id}
                className={`chip ${profile.defaultAccountId === a.id ? 'chip--on' : ''}`}
                onClick={() => setDefaultAccount(profile.defaultAccountId === a.id ? null : a.id)}
              >
                {a.nickname}
              </button>
            ))}
          </div>
          {!profile.defaultAccountId && <p className="fs-12 c-mut m-0">None set: entries start with the first account.</p>}
        </fieldset>
      </Card>

      <SectionTitle>Help</SectionTitle>
      <Group>
        <button onClick={onOpenRules} style={rowButton}>
          <span className="c-sec"><Icon name="info" size={17} /></span>
          <span className="flex-1 fs-14">Rules to remember</span>
          <span className="c-mut"><Icon name="chevron-right" size={15} /></span>
        </button>
      </Group>

      <SectionTitle>Appearance</SectionTitle>
      <Group>
        <div className="flex ai-c gap-12" style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <span className="c-sec"><Icon name="type" size={17} /></span>
          <span className="flex-1 fs-14">Text size</span>
          <span className="ovh" style={{ display: 'inline-flex', border: '1px solid var(--color-border)', borderRadius: 9 }}>
            {(['low', 'medium', 'high'] as const).map(f => (
              <button
                key={f}
                onClick={() => { haptic('tap'); setFontSize(f); setFont(f); }}
                aria-pressed={font === f}
                style={{ padding: '5px 10px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: font === f ? 'var(--color-accent)' : 'transparent', color: font === f ? 'var(--color-on-accent)' : 'var(--color-text-secondary)', textTransform: 'capitalize' }}
              >
                {f}
              </button>
            ))}
          </span>
        </div>
        <div className="flex ai-c gap-12" style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <span className="c-sec"><Icon name="vibrate" size={17} /></span>
          <span className="flex-1 fs-14">Haptic feedback</span>
          <button
            onClick={() => { const on = !haptics; setHaptics(on); setHapticsOn(on); if (on) haptic('tap'); }}
            aria-pressed={haptics}
            style={{ width: 42, height: 24, borderRadius: 14, border: 'none', cursor: 'pointer', background: haptics ? 'var(--color-accent)' : 'var(--color-surface-muted)', position: 'relative', padding: 0 }}
          >
            <span className="abs" style={{ top: 2, left: haptics ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: haptics ? 'var(--color-on-accent)' : 'var(--color-text-secondary)', transition: 'left .2s' }} />
          </button>
        </div>
        <div className="flex ai-c gap-12" style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
          <span className="c-sec"><Icon name="moon" size={17} /></span>
          <span className="flex-1 fs-14">Theme</span>
          <span className="ovh" style={{ display: 'inline-flex', border: '1px solid var(--color-border)', borderRadius: 9 }}>
            {(['dark', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                aria-pressed={profile.theme === t}
                style={{ padding: '5px 11px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: profile.theme === t ? 'var(--color-accent)' : 'transparent', color: profile.theme === t ? 'var(--color-on-accent)' : 'var(--color-text-secondary)', textTransform: 'capitalize' }}
              >
                {t}
              </button>
            ))}
          </span>
        </div>
        <div className="flex ai-c gap-12" style={{ padding: '13px 14px' }}>
          <span className="c-sec"><Icon name="indian-rupee" size={17} /></span>
          <span className="flex-1 fs-14">Currency</span>
          <span className="fs-13 c-sec">₹ INR</span>
        </div>
      </Group>
    </div>
  );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex ai-c jc-sb" style={{ margin: '22px 2px 10px' }}>
      <span className="kicker">{children}</span>
      {action}
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <Card variant="group">{children}</Card>;
}

const rowButton = { display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '12px 14px', background: 'none', border: 'none', color: 'var(--color-text-primary)', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' } as const;

function AccountRow({ a, token, onChanged, onError }: { a: Account; token: string; onChanged: () => void; onError: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(a.nickname);
  const [bank, setBank] = useState(a.bank ?? '');
  const [kind, setKind] = useState<AccountKind>(isAccountKind(a.kind) ? a.kind : 'bank');

  async function rename(e: FormEvent) {
    e.preventDefault();
    try {
      await api('accounts', { method: 'PATCH', token, body: { id: a.id, nickname: name, bank, kind } });
      haptic('success');
      setEditing(false);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not save account');
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the account "${a.nickname}"? This can't be undone.`)) return;
    try {
      await api(`accounts?id=${a.id}`, { method: 'DELETE', token });
      haptic('warning');
      setEditing(false);
      onChanged();
    } catch (err) {
      haptic('error');
      onError(err instanceof Error ? err.message : 'Could not delete account');
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <button onClick={() => setEditing(e => !e)} style={rowButton}>
        <span className="flex-none grid c-sec" style={{ width: 34, height: 34, borderRadius: 9, placeItems: 'center', background: 'var(--color-surface-muted)' }}>
          <Icon name={a.icon ?? 'wallet'} size={16} />
        </span>
        <span className="flex-1">
          <span className="fs-14" style={{ display: 'block' }}>{a.nickname}</span>
          {(a.bank || a.kind) && <span className="fs-11 c-mut" style={{ display: 'block' }}>{[a.bank, isAccountKind(a.kind) ? ACCOUNT_KIND_LABEL[a.kind] : a.kind].filter(Boolean).join(' · ')}</span>}
        </span>
        <span className="c-mut"><Icon name="pencil-line" size={15} /></span>
      </button>
      {editing && (
        <>
          <form className="grid gap-8" onSubmit={rename} style={{ padding: '0 14px 12px' }}>
            <Field label="Nickname">
              <Input value={name} onChange={e => setName(e.target.value)} required maxLength={40} style={{ fontSize: 15 }} />
            </Field>
            <Field label="Bank (optional)">
              <Input value={bank} onChange={e => setBank(e.target.value)} maxLength={60} style={{ fontSize: 15 }} />
            </Field>
            <fieldset className="fieldset-reset grid gap-6">
              <legend className="kicker kicker--spaced">What type</legend>
              <div className="chiprow" style={{ margin: 0, padding: 0 }}>
                {ACCOUNT_KINDS.map(k => (
                  <button type="button" key={k} aria-pressed={kind === k} className={`chip ${kind === k ? 'chip--on' : ''}`} onClick={() => setKind(k)}>{ACCOUNT_KIND_LABEL[k]}</button>
                ))}
              </div>
            </fieldset>
            <Button type="submit">Save account</Button>
          </form>
          <div style={{ padding: '0 14px 12px' }}>
            <button className="link c-danger fs-13" onClick={remove} style={{ padding: 0 }}>Delete account</button>
          </div>
        </>
      )}
    </div>
  );
}

function AddAccount({ token, count, onAdded, onError }: { token: string; count: number; onAdded: () => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bank, setBank] = useState('');
  const [kind, setKind] = useState<AccountKind>('bank');

  if (count >= MAX_ACCOUNTS) return <div className="fs-12 c-mut" style={{ padding: '12px 14px' }}>Up to {MAX_ACCOUNTS} accounts</div>;
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ ...rowButton, color: 'var(--color-accent-text)', fontSize: 12.5, justifyContent: 'center' }}>+ Add account</button>
  );

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api('accounts', { token, body: { nickname, bank: bank || undefined, kind } });
      setNickname('');
      setBank('');
      setKind('bank');
      setOpen(false);
      haptic('success');
      onAdded();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add account');
    }
  }

  return (
    <form className="grid gap-8" onSubmit={add} style={{ padding: 12 }}>
      <Field label="Nickname">
        <Input placeholder="e.g. HDFC Salary" value={nickname} onChange={e => setNickname(e.target.value)} required maxLength={40} style={{ fontSize: 15 }} />
      </Field>
      <Field label="Bank (optional)">
        <Input placeholder="e.g. HDFC" value={bank} onChange={e => setBank(e.target.value)} maxLength={60} style={{ fontSize: 15 }} />
      </Field>
      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">What type</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          {ACCOUNT_KINDS.map(k => (
            <button type="button" key={k} aria-pressed={kind === k} className={`chip ${kind === k ? 'chip--on' : ''}`} onClick={() => setKind(k)}>{ACCOUNT_KIND_LABEL[k]}</button>
          ))}
        </div>
      </fieldset>
      <Button type="submit">Add account</Button>
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
      haptic('success');
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
      haptic('warning');
      onToast('Passcode turned off');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not turn off passcode');
    }
  }

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div className="flex ai-c gap-12" style={{ padding: '13px 14px' }}>
        <span className="c-sec"><Icon name="lock-keyhole" size={17} /></span>
        <span className="flex-1 fs-14">App passcode</span>
        <button className="link" onClick={() => setMode(mode === 'set' ? 'idle' : 'set')} style={{ padding: 0 }}>
          {profile.lockEnabled ? 'Change' : 'Set'}
        </button>
        {profile.lockEnabled && <button className="link" onClick={() => setMode(mode === 'off' ? 'idle' : 'off')} style={{ padding: 0, color: 'var(--color-text-secondary)' }}>Turn off</button>}
      </div>
      {mode === 'set' && (
        <form className="grid gap-8" onSubmit={setPasscode} style={{ padding: '0 14px 12px' }}>
          <Input numeric inputMode="numeric" maxLength={4} placeholder="New 4-digit passcode" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} required style={{ fontSize: 15 }} />
          <Input numeric inputMode="numeric" maxLength={4} placeholder="Repeat passcode" value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g, ''))} required style={{ fontSize: 15 }} />
          <Button type="submit">Save passcode</Button>
        </form>
      )}
      {mode === 'off' && (
        <div className="flex gap-10 ai-c" style={{ padding: '0 14px 12px' }}>
          <span className="flex-1 fs-13 c-sec">Turn off the passcode lock?</span>
          <Button variant="secondary" size="sm" onClick={turnOff}>Turn off</Button>
        </div>
      )}
    </div>
  );
}
