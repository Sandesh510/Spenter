import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Field';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { cache } from '../lib/cache';
import { haptic } from '../lib/haptics';
import { getFontSize, getHaptics, setFontSize, setHaptics, type FontSize } from '../lib/prefs';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth, monthShort, monthSpan, shiftMonth, todayIST } from '../lib/dates';
import { formatINR, paiseToPlain, parseBalanceToPaise } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, HomeData, Profile } from '../lib/types';
import { MAX_ACCOUNTS, MAX_EXPORT_MONTHS } from '../lib/limits';
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABEL, isAccountKind, isCreditCard, normaliseAccountKind, type AccountKind } from '../lib/accountTypes';
import { cardView, flipCardSign } from '../lib/accountBalance';
import { exportFileName, transactionsCsv, type ExportRow } from '../lib/csv';
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
  onOpenFixCards,
}: {
  token: string;
  onToast: (m: string) => void;
  profile: Profile;
  onProfile: (p: Profile) => void;
  onSignOut: () => void;
  onLockNow: () => void;
  email: string | undefined;
  onOpenRules: () => void;
  onOpenFixCards: () => void;
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
        <button onClick={() => setEditorFor('new')} style={{ ...rowButton, color: 'var(--color-accent-text)', fontSize: 13, justifyContent: 'center', borderTop: '1px solid var(--color-border)' }}>
          + Add category
        </button>
        {cats.length > SHOW_FIRST && (
          <button onClick={() => setShowAll(s => !s)} style={{ ...rowButton, justifyContent: 'center', color: 'var(--color-accent-text)', fontSize: 13 }}>
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
          <AccountRow key={a.id} a={a} token={token} onChanged={accounts.reload} onError={setError} onToast={onToast} />
        ))}
        <AddAccount token={token} count={accounts.data?.items.length ?? 0} onAdded={accounts.reload} onError={setError} />
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

      <SectionTitle>Data</SectionTitle>
      <Group>
        <ExportCsv token={token} onToast={onToast} />
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

      <SectionTitle>Help</SectionTitle>
      <Group>
        <button onClick={onOpenFixCards} style={rowButton}>
          <span className="c-sec"><Icon name="credit-card" size={17} /></span>
          <span className="flex-1 fs-14">Fix card repayments saved as spend</span>
          <span className="c-mut"><Icon name="chevron-right" size={15} /></span>
        </button>
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

/** The balance on the right of an account row: the amount, or what a card owes. Nothing when no balance is set. */
function AccountBalance({ a }: { a: Account }) {
  const balance = a.balance_paise ?? null;
  if (balance === null) return null;
  const card = cardView(a.kind, balance, a.credit_limit_paise ?? null);
  if (card) {
    return (
      <span className="grid ta-r">
        {card.outstandingPaise > 0
          ? <span className="num fs-13 nowrap c-danger">Owed {formatINR(card.outstandingPaise)}</span>
          : <span className="num fs-13 nowrap c-sec">Nothing owed</span>}
        {card.availablePaise !== null && (
          <span className={`num fs-11 nowrap ${card.availablePaise < 0 ? 'c-danger' : 'c-mut'}`}>
            {card.availablePaise < 0 ? `${formatINR(-card.availablePaise)} over limit` : `${formatINR(card.availablePaise)} available`}
          </span>
        )}
      </span>
    );
  }
  return <span className={`num fs-13 nowrap ${balance < 0 ? 'c-danger' : 'c-text'}`}>{formatINR(balance)}</span>;
}

/** A stored opening balance as the figure the form shows: cards show what is owed, as a positive number. */
function openingText(a: Account): string {
  const p = a.opening_balance_paise;
  if (p === null || p === undefined) return '';
  return paiseToPlain(isCreditCard(a.kind) ? -p : p).replace(/\.00$/, '');
}

function AccountRow({ a, token, onChanged, onError, onToast }: { a: Account; token: string; onChanged: () => void; onError: (m: string) => void; onToast: (m: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(a.nickname);
  const [bank, setBank] = useState(a.bank ?? '');
  // Older accounts may hold free text such as 'Credit card'; read it as its kind so saving keeps it.
  const [kind, setKind] = useState<AccountKind>(normaliseAccountKind(a.kind) ?? 'bank');
  const [opening, setOpening] = useState(() => openingText(a));
  const [openingOn, setOpeningOn] = useState(a.opening_balance_on ?? todayIST());
  const [limit, setLimit] = useState(a.credit_limit_paise ? paiseToPlain(a.credit_limit_paise).replace(/\.00$/, '') : '');
  const [statementDay, setStatementDay] = useState(a.statement_day ? String(a.statement_day) : '');
  const [dueDay, setDueDay] = useState(a.due_day ? String(a.due_day) : '');
  const [actual, setActual] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  // A saved opening balance (or Match my bank) changes the stored values; show them when the form opens again.
  useEffect(() => {
    setOpening(openingText(a));
    setOpeningOn(a.opening_balance_on ?? todayIST());
  },[a.opening_balance_paise, a.opening_balance_on, a.kind]);
  const isCard = kind === 'credit_card';
  const savedIsCard = isCreditCard(a.kind);
  const kindLabel = isAccountKind(a.kind) ? ACCOUNT_KIND_LABEL[a.kind] : a.kind;

  async function rename(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const openingBalance = flipCardSign(opening, isCard);
    if (openingBalance !== '') {
      try {
        parseBalanceToPaise(openingBalance);
      } catch {
        return setFormError('Enter the opening balance in rupees, e.g. 25000 or 25000.50');
      }
    }
    try {
      await api('accounts', {
        method: 'PATCH',
        token,
        body: { id: a.id, nickname: name, bank, kind, openingBalance, creditLimit: isCard ? limit.trim() : '', statementDay: isCard ? statementDay.trim() : '', dueDay: isCard ? dueDay.trim() : '', ...(openingBalance !== '' ? { openingBalanceOn: openingOn } : {}) },
      });
      haptic('success');
      setEditing(false);
      onChanged();
    } catch (err) {
      haptic('error');
      setFormError(err instanceof Error ? err.message : 'Could not save account');
    }
  }

  async function matchBank(e: FormEvent) {
    e.preventDefault();
    setMatchError(null);
    const value = flipCardSign(actual, savedIsCard);
    try {
      parseBalanceToPaise(value);
    } catch {
      return setMatchError(savedIsCard ? 'Enter what you owe on the card now, e.g. 12000' : 'Enter the balance your bank shows, e.g. 25000');
    }
    try {
      await api('accounts', { method: 'PATCH', token, body: { id: a.id, action: 'reconcile', actual: value } });
      haptic('success');
      setActual('');
      setEditing(false);
      onToast(`${a.nickname} matched`);
      onChanged();
    } catch (err) {
      haptic('error');
      setMatchError(err instanceof Error ? err.message : 'Could not match the balance');
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
        <span className="flex-1 min-0">
          <span className="fs-14" style={{ display: 'block' }}>{a.nickname}</span>
          {(a.bank || a.kind) && <span className="fs-11 c-mut" style={{ display: 'block' }}>{[a.bank, kindLabel].filter(Boolean).join(' · ')}</span>}
        </span>
        <AccountBalance a={a} />
        <span className="c-mut"><Icon name="pencil-line" size={15} /></span>
      </button>
      {editing && (
        <>
          <form className="grid gap-8 row-pane" onSubmit={rename}>
            <Field label="Nickname">
              <Input className="fs-15" value={name} onChange={e => setName(e.target.value)} required maxLength={40} />
            </Field>
            <Field label="Bank (optional)">
              <Input className="fs-15" value={bank} onChange={e => setBank(e.target.value)} maxLength={60} />
            </Field>
            <fieldset className="fieldset-reset grid gap-6">
              <legend className="kicker kicker--spaced">What type</legend>
              <div className="chiprow" style={{ margin: 0, padding: 0 }}>
                {ACCOUNT_KINDS.map(k => (
                  <button type="button" key={k} aria-pressed={kind === k} className={`chip ${kind === k ? 'chip--on' : ''}`} onClick={() => setKind(k)}>{ACCOUNT_KIND_LABEL[k]}</button>
                ))}
              </div>
            </fieldset>
            <div className="grid-2 gap-8">
              <Field
                label={isCard ? 'Owed (opening)' : 'Opening balance'}
                hint={isCard ? 'Enter what you owe on the card. Leave empty for no balance.' : 'Leave empty for no balance.'}
              >
                <Input className="fs-15" numeric inputMode="decimal" placeholder={isCard ? 'e.g. 12000' : 'e.g. 25000'} value={opening} onChange={e => setOpening(e.target.value)} maxLength={16} />
              </Field>
              <Field label="As on" hint="Before that day's entries.">
                <Input className="fs-15" type="date" value={openingOn} max={todayIST()} onChange={e => setOpeningOn(e.target.value)} disabled={opening.trim() === ''} />
              </Field>
            </div>
            {isCard && (
              <Field label="Credit limit (optional)" hint="Shows how much credit is left on the card.">
                <Input className="fs-15" numeric inputMode="decimal" placeholder="e.g. 100000" value={limit} onChange={e => setLimit(e.target.value)} maxLength={16} />
              </Field>
            )}
            {isCard && (
              <div className="grid-2 gap-12">
                <Field label="Bill generated on (day)" hint="Day of the month.">
                  <Input className="fs-15" numeric inputMode="numeric" placeholder="e.g. 5" value={statementDay} onChange={e => setStatementDay(e.target.value)} maxLength={2} />
                </Field>
                <Field label="Bill due on (day)" hint="Day of the month.">
                  <Input className="fs-15" numeric inputMode="numeric" placeholder="e.g. 25" value={dueDay} onChange={e => setDueDay(e.target.value)} maxLength={2} />
                </Field>
              </div>
            )}
            {formError && <p className="c-danger fs-13 m-0" role="alert">{formError}</p>}
            <Button type="submit">Save account</Button>
          </form>
          <form className="row-pane" onSubmit={matchBank}>
            <div className="subform">
            <fieldset className="fieldset-reset grid gap-8">
              <legend className="kicker kicker--spaced">Match my bank</legend>
              <Field
                label={savedIsCard ? 'Owed on the card now' : 'Actual balance now'}
                hint={savedIsCard ? 'What your card app shows you owe. The balance here becomes this.' : 'What your bank app shows. The balance here becomes this.'}
                error={matchError}
              >
                <Input className="fs-15" numeric inputMode="decimal" placeholder="e.g. 25000" value={actual} onChange={e => setActual(e.target.value)} maxLength={16} required />
              </Field>
              <Button type="submit" variant="secondary">Match balance</Button>
            </fieldset>
            </div>
          </form>
          <div className="row-pane">
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
    <button onClick={() => setOpen(true)} style={{ ...rowButton, color: 'var(--color-accent-text)', fontSize: 13, justifyContent: 'center' }}>+ Add account</button>
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

/** Export transactions (CSV): pick a month range, fetch the entries, and save them as a CSV file. */
function ExportCsv({ token, onToast }: { token: string; onToast: (m: string) => void }) {
  const thisMonth = currentMonth();
  const months = useMemo(
    () => Array.from({ length: MAX_EXPORT_MONTHS }, (_, i) => shiftMonth(thisMonth, -i)),
    [thisMonth],
  );
  const [from, setFrom] = useState(thisMonth);
  const [to, setTo] = useState(thisMonth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rangeError = monthSpan(from, to) < 1 ? 'The From month must not be after the To month' : null;

  async function download(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (rangeError) return;
    setBusy(true);
    try {
      const data = await api<{ items: ExportRow[] }>(`export?from=${from}&to=${to}`, { token });
      // The byte-order mark lets spreadsheet apps read the file as UTF-8, so ₹ shows correctly.
      const blob = new Blob(['﻿', transactionsCsv(data.items)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportFileName(from, to);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      haptic('success');
      onToast(data.items.length === 1 ? 'Exported 1 entry' : `Exported ${data.items.length} entries`);
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not export');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-8 group-pad" onSubmit={download}>
      <div className="flex ai-c gap-12">
        <span className="c-sec"><Icon name="download" size={17} /></span>
        <span className="flex-1 fs-14">Export transactions (CSV)</span>
      </div>
      <div className="grid-2 gap-8">
        <Field label="From month">
          <Select value={from} onChange={e => setFrom(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{monthShort(m)}</option>)}
          </Select>
        </Field>
        <Field label="To month">
          <Select value={to} onChange={e => setTo(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{monthShort(m)}</option>)}
          </Select>
        </Field>
      </div>
      {(rangeError || error) && <p className="c-danger fs-13 m-0" role="alert">{rangeError ?? error}</p>}
      <p className="fs-12 c-mut m-0">Every entry in those months, with category, budget and account. Opens in any spreadsheet app.</p>
      <Button type="submit" variant="secondary" disabled={busy || rangeError !== null}>
        {busy ? 'Preparing…' : 'Download CSV'}
      </Button>
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
