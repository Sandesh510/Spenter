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
import { isCreditCard } from '../lib/accountTypes';
import { AddAnotherPrompt } from '../components/ui/AddAnotherPrompt';
import type { Account, HomeData, Loan, TxnRow } from '../lib/types';
import type { Route } from '../App';

type Kind = 'spend' | 'transfer' | 'self' | 'credit';
const KINDS: { id: Kind; label: string; icon: string }[] = [
  { id: 'spend', label: 'Spend', icon: 'arrow-up-right' },
  { id: 'transfer', label: 'Transfer', icon: 'arrow-left-right' },
  { id: 'self', label: 'Self transfer', icon: 'repeat' },
  { id: 'credit', label: 'Credit / money in', icon: 'arrow-down-left' },
];

/** The only credit categories. A credit is always one of these, never a spend category. */
type CreditCategory = 'salary' | 'gone_back' | 'others' | 'borrowed';
const CREDIT_SECTIONS: { id: CreditCategory; label: string }[] = [
  { id: 'salary', label: 'Salary' },
  { id: 'gone_back', label: 'Got back' },
  { id: 'others', label: 'Others' },
  { id: 'borrowed', label: 'Borrowed' },
];

/**
 * Manual entry: older or non-spend transactions. Layout from screens/ScreenAdd.dc.html.
 * With `editing`, the same form opens filled in and saves changes to that transaction.
 */
export function Manual({ token, go, onToast, editing }: { token: string; go: (r: Route) => void; onToast: (m: string) => void; editing: TxnRow | null }) {
  const [kind, setKind] = useState<Kind>(editing ? (editing.type === 'credit' ? 'credit' : editing.type === 'transfer' ? 'transfer' : 'spend') : 'spend');
  const [amount, setAmount] = useState(editing ? String(editing.amount_paise / 100) : '');
  const [desc, setDesc] = useState(editing?.description ?? '');
  const [reference, setReference] = useState(editing?.reference ?? '');
  const [creditCategory, setCreditCategory] = useState<CreditCategory>((editing?.credit_category as CreditCategory | null) ?? 'salary');
  const [lentLoanId, setLentLoanId] = useState<string | null>(editing?.lent_loan_id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  const [accountId, setAccountId] = useState<string | null>(editing?.account_id ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(editing?.to_account_id ?? null);
  const [date, setDate] = useState(editing?.txn_date ?? todayIST());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set after a new entry is saved, so the user can add another on the same date. */
  const [savedNew, setSavedNew] = useState(false);

  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const lent = useApi<{ items: Loan[] }>('lent', token);
  const categories = home.data?.categories ?? [];
  const accountList = accounts.data?.items ?? [];
  const openLoans = (lent.data?.items ?? []).filter(l => l.outstanding_paise > 0);
  const isTransfer = kind === 'transfer' || kind === 'self';
  const isCredit = kind === 'credit';
  // Transfers to outside the tracked accounts have no destination account; they can only be edited, not created here.
  const external = editing?.external ?? false;
  const from = accountId ?? accountList[0]?.id ?? null;
  const to = toAccountId ?? accountList.find(a => a.id !== from)?.id ?? null;
  // Paying a card bill is a transfer into the card account, so it is never counted as spend.
  const toIsCard = isCreditCard(accountList.find(a => a.id === to)?.kind);
  // A credit has one note, the reference. Spend and transfers use the description.
  const note = isCredit ? reference : desc;
  const setNote = isCredit ? setReference : setDesc;

  async function save() {
    setError(null);
    let paise: number;
    try {
      paise = parseRupeesToPaise(amount);
    } catch {
      return setError('Enter an amount first');
    }
    if (!from) return setError('Add an account in Settings first');
    if (kind === 'spend' && !categoryId) return setError('Choose a category');
    if (isTransfer && !external && (!to || to === from)) return setError('Choose two different accounts');

    const linkedLoan = openLoans.find(l => l.id === lentLoanId) ?? (editing?.lent_loan_id ? (lent.data?.items ?? []).find(l => l.id === editing.lent_loan_id) : undefined);
    if (isCredit && creditCategory === 'gone_back' && lentLoanId) {
      // The loan's outstanding amount already excludes this credit when editing it, so add it back.
      const available = (linkedLoan?.outstanding_paise ?? 0) + (editing?.lent_loan_id === lentLoanId ? (editing?.amount_paise ?? 0) : 0);
      if (paise > available) return setError(`More than the ${formatINR(available)} still owed`);
    }

    const body = isTransfer
      ? { type: 'transfer', amount, date, description: desc.trim() || null, accountId: from, toAccountId: external ? null : to, external }
      : isCredit
        ? { type: 'credit', amount, date, accountId: from, creditCategory, reference: reference.trim() || null, lentLoanId: creditCategory === 'gone_back' ? lentLoanId : null }
        : { type: 'spend', amount, date, description: desc.trim() || null, categoryId, accountId: from };

    setSaving(true);
    try {
      if (editing) {
        await api('transactions', { method: 'PATCH', token, body: { id: editing.id, ...body } });
        await refreshAll(token).catch(() => {});
      } else {
        await api('transactions', { token, body });
      }
      // Log, Home and Lent read from the cache, so a saved entry must refresh it.
      await refreshAll(token).catch(() => {});
      haptic('success');
      if (editing) {
        onToast('Transaction updated');
        go('log');
      } else {
        onToast(`Saved ${formatINR(paise)}`);
        setSavedNew(true);
      }
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  /** Yes: clear the amount, category and note. Date, account and transaction type stay. */
  function addAnother() {
    setAmount('');
    setCategoryId(null);
    setDesc('');
    setReference('');
    setLentLoanId(null);
    setError(null);
    setSavedNew(false);
  }

  const accountName = (id: string | null) => accountList.find(a => a.id === id)?.nickname ?? 'Choose';
  const saveLabel = editing
    ? 'Save changes'
    : kind === 'spend' ? 'Save spend' : kind === 'credit' ? 'Save credit' : kind === 'self' ? 'Save self transfer' : 'Save transfer';

  return (
    <div className="scroll scroll--stack" style={{ paddingBottom: 24 }}>
      {savedNew && <AddAnotherPrompt date={date} onYes={addAnother} onNo={() => go('log')} />}
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go(editing ? 'log' : 'quickadd')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">{editing ? 'Edit transaction' : 'Add transaction'}</span>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      <div className="chiprow mt-8">
        {KINDS.map(k => (
          <button key={k.id} className={`chip ${kind === k.id ? 'chip--on' : ''}`} onClick={() => setKind(k.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name={k.icon} size={13} />
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex ai-c gap-10 mt-12" style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: '11px 13px', background: 'var(--color-surface)' }}>
        <span className="c-mut"><Icon name="pencil-line" size={15} /></span>
        <Input className="fs-14" style={{ borderBottom: 'none', padding: 0 }} placeholder={isCredit ? 'Reference (optional)' : 'Description (optional)'} value={note} onChange={e => setNote(e.target.value)} maxLength={120} aria-label={isCredit ? 'Reference' : 'Description'} />
      </div>

      <div className="flex gap-10 mt-10">
        <Picker label={isTransfer ? 'From' : isCredit ? 'Into account' : 'Account'} icon="wallet" value={accountName(from)} options={accountList} selected={from} onPick={setAccountId} />
        {isTransfer ? (
          external ? (
            <div className="c-sec fs-13" style={{ ...pickerStyle, cursor: 'default' }}>
              <Icon name="arrow-right" size={15} /> Outside
            </div>
          ) : (
            <Picker label="To" icon="arrow-right" value={accountName(to)} options={accountList} selected={to} onPick={setToAccountId} />
          )
        ) : (
          <label style={pickerStyle}>
            <span className="c-mut"><Icon name="calendar" size={14} /></span>
            <input type="date" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} aria-label="Date" style={{ background: 'transparent', border: 'none', color: 'var(--color-text-primary)', fontFamily: 'inherit', fontSize: 13, padding: 0, flex: 1, minWidth: 0 }} />
          </label>
        )}
      </div>
      {isTransfer && !external && toIsCard && (
        <div className="flex ai-c gap-6 mt-6 fs-12 c-sec">
          <Icon name="credit-card" size={13} /> Card bill payment: a transfer, not spend.
        </div>
      )}

      {kind === 'spend' && (
        <>
          <div className="kicker" style={{ margin: '16px 0 7px' }}>Category</div>
          <div className="chiprow">
            {categories.map(c => (
              <button key={c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>{c.name}</button>
            ))}
          </div>
        </>
      )}

      {isCredit && (
        <>
          <div className="kicker" style={{ margin: '16px 0 7px' }}>Credit type</div>
          <div className="chiprow">
            {CREDIT_SECTIONS.map(s => (
              <button key={s.id} className={`chip ${creditCategory === s.id ? 'chip--on' : ''}`} onClick={() => setCreditCategory(s.id)}>{s.label}</button>
            ))}
          </div>
          {creditCategory === 'gone_back' && (
            <>
              <div className="kicker" style={{ margin: '16px 0 7px' }}>Which loan (optional)</div>
              {openLoans.length === 0 ? (
                <p className="fs-13 c-sec" style={{ margin: 0 }}>No open loans. Just record the reference, e.g. the person's name.</p>
              ) : (
                <div className="chiprow">
                  {openLoans.map(l => (
                    <button key={l.id} aria-pressed={lentLoanId === l.id} className={`chip ${lentLoanId === l.id ? 'chip--on' : ''}`} onClick={() => { setLentLoanId(l.id); if (!reference.trim()) setReference(l.person_name); if (l.debit_account_id) setAccountId(l.debit_account_id); }}>
                      {l.person_name} · {formatINR(l.outstanding_paise)}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="num flex ai-c jc-c gap-2" style={{ padding: '16px 0 12px' }}>
        <span className="heading fs-24 c-sec">₹</span>
        <span className="heading fs-44 fw-600" style={{ lineHeight: 1 }}>{amount ? Number(amount).toLocaleString('en-IN') : '0'}</span>
      </div>

      <Keypad fill onKey={k => setAmount(a => applyKey(a, k))} />

      {error && <p className="c-danger fs-13 mt-10" role="alert">{error}</p>}

      <Button className="mt-12" size="lg" block onClick={save} disabled={saving}>
        <Icon name="check" size={18} /> {saving ? 'Saving…' : saveLabel}
      </Button>
    </div>
  );
}

const pickerStyle = { flex: 1, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--color-border)', borderRadius: 12, padding: '11px 12px', minWidth: 0, cursor: 'pointer' } as const;

/** Account picker: a native select styled as the mockup's bordered card. */
function Picker({ label, icon, value, options, selected, onPick }: { label: string; icon: string; value: string; options: Account[]; selected: string | null; onPick: (id: string) => void }) {
  return (
    <label className="rel" style={{ ...pickerStyle }}>
      <span className="c-mut"><Icon name={icon} size={15} /></span>
      <span className="fs-13 flex-1 min-0 ovh ellipsis nowrap">{value}</span>
      <Icon name="chevron-down" size={14} />
      <select aria-label={label} value={selected ?? ''} onChange={e => onPick(e.target.value)} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}>
        {options.map(a => (
          <option key={a.id} value={a.id}>{a.nickname}</option>
        ))}
      </select>
    </label>
  );
}
