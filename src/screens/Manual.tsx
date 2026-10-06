import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Keypad, applyKey } from '../components/Keypad';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { currentMonth, todayIST } from '../lib/dates';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { useApi } from '../lib/useApi';
import { refreshAll } from '../lib/cache';
import type { Account, HomeData, TxnRow } from '../lib/types';
import type { Route } from '../App';

type Kind = 'spend' | 'transfer' | 'self' | 'credit';
const KINDS: { id: Kind; label: string; icon: string }[] = [
  { id: 'spend', label: 'Spend', icon: 'arrow-up-right' },
  { id: 'transfer', label: 'Transfer', icon: 'arrow-left-right' },
  { id: 'self', label: 'Self transfer', icon: 'repeat' },
  { id: 'credit', label: 'Credit / money in', icon: 'arrow-down-left' },
];

/**
 * Manual entry: older or non-spend transactions. Layout from screens/ScreenAdd.dc.html.
 * With `editing`, the same form opens filled in and saves changes to that transaction.
 */
export function Manual({ token, go, onToast, editing }: { token: string; go: (r: Route) => void; onToast: (m: string) => void; editing: TxnRow | null }) {
  const [kind, setKind] = useState<Kind>(editing ? (editing.type === 'credit' ? 'credit' : editing.type === 'transfer' ? 'transfer' : 'spend') : 'spend');
  const [amount, setAmount] = useState(editing ? String(editing.amount_paise / 100) : '');
  const [desc, setDesc] = useState(editing?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(editing?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(editing?.to_account_id ?? null);
  const [date, setDate] = useState(editing?.txn_date ?? todayIST());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const categories = home.data?.categories ?? [];
  const accountList = accounts.data?.items ?? [];
  const isTransfer = kind === 'transfer' || kind === 'self';
  // Transfers to outside the tracked accounts have no destination account; they can only be edited, not created here.
  const external = editing?.external ?? false;
  const from = accountId ?? accountList[0]?.id ?? null;
  const to = toAccountId ?? accountList.find(a => a.id !== from)?.id ?? null;

  async function save() {
    setError(null);
    let paise: number;
    try {
      paise = parseRupeesToPaise(amount);
    } catch {
      return setError('Enter an amount first');
    }
    if (!from) return setError('Add an account in Settings first');
    if (!isTransfer && !categoryId) return setError('Choose a category');
    if (isTransfer && !external && (!to || to === from)) return setError('Choose two different accounts');

    const body = isTransfer
      ? { type: 'transfer', amount, date, description: desc.trim() || null, accountId: from, toAccountId: external ? null : to, external }
      : { type: kind === 'credit' ? 'credit' : 'spend', amount, date, description: desc.trim() || null, categoryId, accountId: from };

    setSaving(true);
    try {
      if (editing) {
        await api('transactions', { method: 'PATCH', token, body: { id: editing.id, ...body } });
        await refreshAll(token).catch(() => {});
      } else {
        await api('transactions', { token, body });
      }
      haptic('success');
      onToast(editing ? 'Transaction updated' : `Saved ${formatINR(paise)}`);
      go('log');
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const accountName = (id: string | null) => accountList.find(a => a.id === id)?.nickname ?? 'Choose';
  const saveLabel = editing
    ? 'Save changes'
    : kind === 'spend' ? 'Save spend' : kind === 'credit' ? 'Save credit' : kind === 'self' ? 'Save self transfer' : 'Save transfer';

  return (
    <div className="scroll scroll--stack" style={{ paddingBottom: 24 }}>
      <div className="topbar" style={{ padding: '8px 0 4px' }}>
        <button className="iconbtn" onClick={() => go(editing ? 'log' : 'quickadd')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">{editing ? 'Edit transaction' : 'Add transaction'}</span>
        <span style={{ width: 36 }} />
      </div>

      <div className="chiprow" style={{ marginTop: 8 }}>
        {KINDS.map(k => (
          <button key={k.id} className={`chip ${kind === k.id ? 'chip--on' : ''}`} onClick={() => setKind(k.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name={k.icon} size={13} />
            {k.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--color-border)', borderRadius: 12, padding: '11px 13px', background: 'var(--color-surface)', marginTop: 12 }}>
        <span style={{ color: 'var(--color-text-muted)' }}><Icon name="pencil-line" size={15} /></span>
        <Input  style={{ fontSize: 14, borderBottom: 'none', padding: 0 }} placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} maxLength={120} aria-label="Description" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <Picker label={isTransfer ? 'From' : 'Account'} icon="wallet" value={accountName(from)} options={accountList} selected={from} onPick={setAccountId} />
        {isTransfer ? (
          external ? (
            <div style={{ ...pickerStyle, cursor: 'default', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              <Icon name="arrow-right" size={15} /> Outside
            </div>
          ) : (
            <Picker label="To" icon="arrow-right" value={accountName(to)} options={accountList} selected={to} onPick={setToAccountId} />
          )
        ) : (
          <label style={pickerStyle}>
            <span style={{ color: 'var(--color-text-muted)' }}><Icon name="calendar" size={14} /></span>
            <input type="date" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} aria-label="Date" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontFamily: 'inherit', fontSize: 13, padding: 0, flex: 1, minWidth: 0 }} />
          </label>
        )}
      </div>

      {!isTransfer && (
        <>
          <div className="kicker" style={{ margin: '16px 0 7px' }}>Category</div>
          <div className="chiprow">
            {categories.map(c => (
              <button key={c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>{c.name}</button>
            ))}
          </div>
        </>
      )}

      <div className="num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '16px 0 12px' }}>
        <span className="heading" style={{ fontSize: 24, color: 'var(--color-text-secondary)' }}>₹</span>
        <span className="heading" style={{ fontSize: 42, lineHeight: 1, fontWeight: 600 }}>{amount ? Number(amount).toLocaleString('en-IN') : '0'}</span>
      </div>

      <Keypad fill onKey={k => setAmount(a => applyKey(a, k))} />

      {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <Button size="lg" block onClick={save} disabled={saving} style={{ marginTop: 12 }}>
        <Icon name="check" size={18} /> {saving ? 'Saving…' : saveLabel}
      </Button>
    </div>
  );
}

const pickerStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border)', borderRadius: 12, padding: '11px 12px', minWidth: 0, cursor: 'pointer' } as const;

/** Account picker: a native select styled as the mockup's bordered card. */
function Picker({ label, icon, value, options, selected, onPick }: { label: string; icon: string; value: string; options: Account[]; selected: string | null; onPick: (id: string) => void }) {
  return (
    <label style={{ ...pickerStyle, position: 'relative' }}>
      <span style={{ color: 'var(--color-text-muted)' }}><Icon name={icon} size={15} /></span>
      <span style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
      <Icon name="chevron-down" size={14} />
      <select aria-label={label} value={selected ?? ''} onChange={e => onPick(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}>
        {options.map(a => (
          <option key={a.id} value={a.id}>{a.nickname}</option>
        ))}
      </select>
    </label>
  );
}
