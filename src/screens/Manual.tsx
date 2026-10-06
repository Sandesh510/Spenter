import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Keypad, applyKey } from '../components/Keypad';
import { api } from '../lib/api';
import { currentMonth, todayIST } from '../lib/dates';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, HomeData } from '../lib/types';
import type { Route } from '../App';

type Kind = 'spend' | 'transfer' | 'self' | 'credit';
const KINDS: { id: Kind; label: string; icon: string }[] = [
  { id: 'spend', label: 'Spend', icon: 'arrow-up-right' },
  { id: 'transfer', label: 'Transfer', icon: 'arrow-left-right' },
  { id: 'self', label: 'Self transfer', icon: 'repeat' },
  { id: 'credit', label: 'Credit / money in', icon: 'arrow-down-left' },
];

/** Manual entry: older or non-spend transactions. Layout from screens/ScreenAdd.dc.html. */
export function Manual({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const [kind, setKind] = useState<Kind>('spend');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIST());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const categories = home.data?.categories ?? [];
  const accountList = accounts.data?.items ?? [];
  const isTransfer = kind === 'transfer' || kind === 'self';
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
    if (isTransfer && (!to || to === from)) return setError('Choose two different accounts');

    const body = isTransfer
      ? { type: 'transfer', amount, date, description: desc.trim() || null, accountId: from, toAccountId: to }
      : { type: kind === 'credit' ? 'credit' : 'spend', amount, date, description: desc.trim() || null, categoryId, accountId: from };

    setSaving(true);
    try {
      await api('transactions', { token, body });
      onToast(`Saved ${formatINR(paise)}`);
      go('log');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const accountName = (id: string | null) => accountList.find(a => a.id === id)?.nickname ?? 'Choose';
  const saveLabel = kind === 'spend' ? 'Save spend' : kind === 'credit' ? 'Save credit' : kind === 'self' ? 'Save self transfer' : 'Save transfer';

  return (
    <div className="scroll" style={{ paddingBottom: 24 }}>
      <div className="topbar" style={{ padding: '8px 0 4px' }}>
        <button className="iconbtn" onClick={() => go('quickadd')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">Add transaction</span>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px', background: 'var(--surface)', marginTop: 12 }}>
        <span style={{ color: 'var(--faint)' }}><Icon name="pencil-line" size={15} /></span>
        <input className="input" style={{ fontSize: 14, borderBottom: 'none', padding: 0 }} placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} maxLength={120} aria-label="Description" />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <Picker label={isTransfer ? 'From' : 'Account'} icon="wallet" value={accountName(from)} options={accountList} selected={from} onPick={setAccountId} />
        {isTransfer ? (
          <Picker label="To" icon="arrow-right" value={accountName(to)} options={accountList} selected={to} onPick={setToAccountId} />
        ) : (
          <label style={pickerStyle}>
            <span style={{ color: 'var(--faint)' }}><Icon name="calendar" size={14} /></span>
            <input type="date" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} aria-label="Date" style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13, padding: 0, flex: 1, minWidth: 0 }} />
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
        <span className="heading" style={{ fontSize: 24, color: 'var(--muted)' }}>₹</span>
        <span className="heading" style={{ fontSize: 42, lineHeight: 1, fontWeight: 600 }}>{amount ? Number(amount).toLocaleString('en-IN') : '0'}</span>
      </div>

      <Keypad onKey={k => setAmount(a => applyKey(a, k))} />

      {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</p>}

      <button className="btn" onClick={save} disabled={saving} style={{ width: '100%', height: 52, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--font-heading)', fontWeight: 600 }}>
        <Icon name="check" size={18} /> {saving ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}

const pickerStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 12, padding: '11px 12px', minWidth: 0, cursor: 'pointer' } as const;

/** Account picker: a native select styled as the mockup's bordered card. */
function Picker({ label, icon, value, options, selected, onPick }: { label: string; icon: string; value: string; options: Account[]; selected: string | null; onPick: (id: string) => void }) {
  return (
    <label style={{ ...pickerStyle, position: 'relative' }}>
      <span style={{ color: 'var(--faint)' }}><Icon name={icon} size={15} /></span>
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
