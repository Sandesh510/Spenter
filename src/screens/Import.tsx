import { useEffect, useState, type FormEvent } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, TextArea } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { pickAccount } from '../lib/defaultAccount';
import { useDefaultAccountId } from '../lib/useDefaultAccount';
import { refreshAll } from '../lib/cache';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth, todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { matchAccount, parseLines, type ParsedLine } from '../lib/parseText';
import { useApi } from '../lib/useApi';
import type { Account, Bucket, HomeData, TxnRow } from '../lib/types';
import type { Route } from '../App';

type Stage = 'paste' | 'review' | 'done';
type CreditType = 'salary' | 'others' | 'borrowed';
const CREDIT_TYPES: { id: CreditType; label: string }[] = [
  { id: 'salary', label: 'Salary' },
  { id: 'others', label: 'Others' },
  { id: 'borrowed', label: 'Borrowed' },
];

const EXAMPLE = '03/10/2026, Savings, 450, Groceries\n04/10/2026, Credit card, 1,299, Amazon\n05/10/2026, Wallet, 60';

/**
 * Paste lines of "date, account, amount[, description]", then review them one at a time.
 * Each entry is saved only when the user taps Save; Skip moves on. Unreadable lines are filled in by hand.
 */
export function Import({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const [stage, setStage] = useState<Stage>('paste');
  const [text, setText] = useState('');
  const [items, setItems] = useState<ParsedLine[]>([]);
  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [pasteError, setPasteError] = useState<string | null>(null);

  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);

  function read() {
    const parsed = parseLines(text, todayIST());
    if (parsed.length === 0) return setPasteError('Paste at least one line: date, account, amount');
    setPasteError(null);
    setItems(parsed);
    setIndex(0);
    setAdded(0);
    setSkipped(0);
    setStage('review');
  }

  async function next(saved: boolean) {
    if (saved) setAdded(n => n + 1);
    else setSkipped(n => n + 1);
    if (index + 1 < items.length) {
      setIndex(i => i + 1);
    } else {
      setStage('done');
      if (saved || added > 0) await refreshAll(token).catch(() => {});
    }
  }

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('quickadd')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Paste a list</h1>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      {stage === 'paste' && (
        <section className="grid gap-12 mt-8" aria-label="Paste entries">
          <p className="fs-13 c-sec m-0">One entry per line: <strong>date, account, amount</strong>, and an optional description. Add “Cr” after the amount for money in.</p>
          <Field label="Entries" error={pasteError}>
            <TextArea value={text} onChange={e => setText(e.target.value)} placeholder={EXAMPLE} spellCheck={false} />
          </Field>
          <Button block size="lg" onClick={read} disabled={!text.trim()}>Review entries</Button>
          <p className="fs-12 c-mut m-0">Dates are day first (03/10/2026). Account can be a name, a bank, or a type such as Savings, Credit card or Wallet. Nothing is saved until you tap Save on each entry.</p>
        </section>
      )}

      {stage === 'review' && items[index] && (
        <ReviewItem
          key={index}
          token={token}
          item={items[index]}
          position={index + 1}
          total={items.length}
          accounts={accounts.data?.items ?? []}
          categories={home.data?.categories ?? []}
          onSaved={() => { haptic('success'); next(true); }}
          onSkip={() => next(false)}
        />
      )}

      {stage === 'done' && (
        <Card as="section" className="mt-12" aria-label="Summary">
          <h2 className="fs-18 m-0">All done</h2>
          <dl className="grid gap-8 m-0 mt-12 fs-14">
            <div className="flex jc-sb"><dt className="c-sec">Added</dt><dd className="m-0 num c-success">{added}</dd></div>
            <div className="flex jc-sb"><dt className="c-sec">Skipped</dt><dd className="m-0 num">{skipped}</dd></div>
          </dl>
          <div className="flex gap-8 mt-16">
            <Button variant="secondary" block onClick={() => { setText(''); setStage('paste'); }}>Paste more</Button>
            <Button block onClick={() => { onToast(`${added} added, ${skipped} skipped`); go('log'); }}>Go to Log</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function ReviewItem({
  token,
  item,
  position,
  total,
  accounts,
  categories,
  onSaved,
  onSkip,
}: {
  token: string;
  item: ParsedLine;
  position: number;
  total: number;
  accounts: Account[];
  categories: HomeData['categories'];
  onSaved: () => void;
  onSkip: () => void;
}) {
  const [amount, setAmount] = useState(item.amount);
  const [description, setDescription] = useState(item.description);
  const [date, setDate] = useState(item.date ?? '');
  const [kind, setKind] = useState<'spend' | 'credit'>(item.kind);
  const defaultAccountId = useDefaultAccountId(token);
  // The named account, or the default account when the line names none. An unknown name is left for the user to pick.
  const initialAccount = () => (item.accountHint.trim() ? matchAccount(item.accountHint, accounts) : pickAccount(accounts, defaultAccountId));
  const [accountId, setAccountId] = useState<string | null>(initialAccount);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [creditType, setCreditType] = useState<CreditType>('others');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  // Accounts can arrive after the first render: match the pasted account once they do.
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(initialAccount());
  }, [accounts, accountId, item.accountHint, defaultAccountId]);

  // Warn (do not block) when the same date, amount and account is already in the Log.
  useEffect(() => {
    let paise = 0;
    try {
      paise = parseRupeesToPaise(amount);
    } catch {
      paise = 0;
    }
    if (!date || !accountId || paise <= 0) {
      setDuplicate(false);
      return;
    }
    let live = true;
    api<{ items: TxnRow[] }>(`transactions?month=${date.slice(0, 7)}`, { token })
      .then(r => {
        if (live) setDuplicate(r.items.some(t => t.txn_date === date && t.amount_paise === paise && t.account_id === accountId));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [token, date, amount, accountId]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      parseRupeesToPaise(amount);
    } catch {
      return setErr('Enter an amount more than zero');
    }
    if (!date) return setErr('Choose a date');
    if (date > todayIST()) return setErr('The date cannot be in the future');
    if (!accountId) return setErr('Choose an account');
    if (kind === 'spend' && !categoryId) return setErr('Choose a category');

    const body = kind === 'spend'
      ? { type: 'spend', amount, date, categoryId, accountId, description: description.trim() || null }
      : { type: 'credit', amount, date, accountId, creditCategory: creditType, reference: description.trim() || null };
    setBusy(true);
    try {
      await api('transactions', { token, body });
      onSaved();
    } catch (e2) {
      haptic('error');
      setErr(e2 instanceof Error ? e2.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const buckets: Bucket[] = ['need', 'want', 'save'];

  return (
    <form onSubmit={save} className="grid gap-12 mt-8" aria-label={`Entry ${position} of ${total}`}>
      <div className="flex ai-c jc-sb">
        <span className="kicker">Entry {position} of {total}</span>
        {duplicate && <Badge tone="info">Possible duplicate</Badge>}
      </div>

      <Card variant="compact" as="section" aria-label="Pasted line">
        <p className="fs-12 c-mut m-0">Line {item.line}</p>
        <p className="fs-13 m-0 mt-4 ellipsis ovh nowrap">{item.raw}</p>
        {item.error && <p className="fs-12 c-danger m-0 mt-4">{item.error}. Fill in the details below.</p>}
        {!item.error && amount && <p className="num fs-22 m-0 mt-8">{kind === 'credit' ? '+' : ''}{safeFormat(amount)}</p>}
      </Card>

      {duplicate && <p className="fs-12 c-sec m-0">An entry with the same date, amount and account is already in the Log. Skip this one if it is the same.</p>}

      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">Type</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          <button type="button" aria-pressed={kind === 'spend'} className={`chip ${kind === 'spend' ? 'chip--on' : ''}`} onClick={() => setKind('spend')}>Spend</button>
          <button type="button" aria-pressed={kind === 'credit'} className={`chip ${kind === 'credit' ? 'chip--on' : ''}`} onClick={() => setKind('credit')}>Money in</button>
        </div>
      </fieldset>

      <div className="grid-2 gap-12">
        <Field label="Amount (₹)">
          <Input numeric inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} required />
        </Field>
      </div>

      <Field label={kind === 'credit' ? 'Reference (optional)' : 'Description (optional)'}>
        <Input value={description} onChange={e => setDescription(e.target.value)} maxLength={120} />
      </Field>

      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">Account{item.accountHint && !matchAccount(item.accountHint, accounts) ? ` (“${item.accountHint}” not found)` : ''}</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          {accounts.map(a => (
            <button type="button" key={a.id} aria-pressed={accountId === a.id} className={`chip ${accountId === a.id ? 'chip--on' : ''}`} onClick={() => setAccountId(a.id)}>{a.nickname}</button>
          ))}
        </div>
      </fieldset>

      {kind === 'spend' ? (
        buckets.map(b => {
          const list = categories.filter(c => c.bucket === b);
          if (list.length === 0) return null;
          return (
            <fieldset key={b} className="fieldset-reset grid gap-6">
              <legend className="kicker kicker--spaced">{BUCKET_LABEL[b]}</legend>
              <div className="chiprow" style={{ margin: 0, padding: 0, flexWrap: 'wrap' }}>
                {list.map(c => (
                  <button type="button" key={c.id} aria-pressed={categoryId === c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>{c.name}</button>
                ))}
              </div>
            </fieldset>
          );
        })
      ) : (
        <fieldset className="fieldset-reset grid gap-6">
          <legend className="kicker kicker--spaced">Money in type</legend>
          <div className="chiprow" style={{ margin: 0, padding: 0 }}>
            {CREDIT_TYPES.map(t => (
              <button type="button" key={t.id} aria-pressed={creditType === t.id} className={`chip ${creditType === t.id ? 'chip--on' : ''}`} onClick={() => setCreditType(t.id)}>{t.label}</button>
            ))}
          </div>
        </fieldset>
      )}

      {err && <p className="c-danger fs-13 m-0" role="alert">{err}</p>}

      <div className="flex gap-8">
        <Button variant="secondary" block onClick={onSkip} disabled={busy}>Skip</Button>
        <Button type="submit" block disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  );
}

function safeFormat(amount: string): string {
  try {
    return formatINR(parseRupeesToPaise(amount));
  } catch {
    return amount;
  }
}
