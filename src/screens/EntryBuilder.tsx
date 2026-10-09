import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { addTransactionToCache, refreshInBackground } from '../lib/cache';
import { isoDay, monthGrid, shortDate } from '../lib/calendar';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth, monthTitle, shiftMonth, todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { pickAccount } from '../lib/defaultAccount';
import { useDefaultAccountId } from '../lib/useDefaultAccount';
import type { Account, Bucket, HomeData, TxnRow } from '../lib/types';

/** One entry made on the calendar, waiting to be saved. */
interface Draft {
  id: number;
  date: string;
  accountId: string;
  amount: string;
  categoryId: string;
  description: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BUCKETS: Bucket[] = ['need', 'want', 'save'];
/** Entries saved at the same time, so a long list does not open dozens of requests at once. */
const BATCH = 4;

let nextId = 1;

/**
 * Make entries by tapping dates on a calendar: pick a day, then the account, amount and category.
 * Each one joins a list that is saved together, so nothing has to be typed in a format a parser can misread.
 */
export function EntryBuilder({ token, accounts, categories, onDone }: {
  token: string;
  accounts: Account[];
  categories: HomeData['categories'];
  onDone: (added: number) => void;
}) {
  const today = todayIST();
  const thisMonth = currentMonth();
  const [month, setMonth] = useState(thisMonth);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const defaultAccountId = useDefaultAccountId(token);
  /** The account used for the last entry, so a run of entries on one account needs no re-picking. */
  const [lastAccountId, setLastAccountId] = useState<string | null>(null);
  const startAccountId = lastAccountId ?? pickAccount(accounts, defaultAccountId);

  const { blanks, days } = monthGrid(month);
  const countOn = (date: string) => drafts.filter(d => d.date === date).length;
  const accountName = (id: string) => accounts.find(a => a.id === id)?.nickname ?? 'Account';
  const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? 'Category';
  const sorted = [...drafts].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const totalPaise = drafts.reduce((s, d) => s + toPaise(d.amount), 0);

  function addDraft(d: Omit<Draft, 'id'>) {
    setDrafts(list => [...list, { ...d, id: nextId++ }]);
    setLastAccountId(d.accountId);
    setSaveError(null);
  }

  async function saveAll() {
    setSaving(true);
    setSaveError(null);
    const failed = new Set<number>();
    let added = 0;
    for (let i = 0; i < sorted.length; i += BATCH) {
      const batch = sorted.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(d => api<{ id: string; item?: TxnRow }>('transactions', {
          token,
          body: { type: 'spend', amount: d.amount, date: d.date, categoryId: d.categoryId, accountId: d.accountId, description: d.description.trim() || null },
        })),
      );
      results.forEach((r, k) => {
        if (r.status === 'fulfilled') {
          added += 1;
          if (r.value.item) addTransactionToCache(r.value.item);
        } else failed.add(batch[k].id);
      });
    }
    if (added > 0) refreshInBackground(token);
    setSaving(false);
    if (failed.size === 0) {
      haptic('success');
      return onDone(added);
    }
    haptic('error');
    setDrafts(list => list.filter(d => failed.has(d.id)));
    setSaveError(`${added} saved. ${failed.size} could not be saved and ${failed.size === 1 ? 'is' : 'are'} still in the list. Try again.`);
  }

  return (
    <section className="grid gap-12 mt-8" aria-label="Make entries on a calendar">
      <p className="fs-13 c-sec m-0">Tap a date, then fill in the account, amount and category. Add as many as you like, then save them together.</p>

      <Card variant="compact" as="section" aria-label="Calendar">
        <div className="flex ai-c jc-sb">
          <button type="button" className="iconbtn" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month"><Icon name="chevron-left" size={18} /></button>
          <h2 className="fs-15 m-0">{monthTitle(month)}</h2>
          <button type="button" className="iconbtn" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month" disabled={month >= thisMonth}><Icon name="chevron-right" size={18} /></button>
        </div>
        <div className="cal__grid mt-12" aria-hidden="true">
          {WEEKDAYS.map(w => <span key={w} className="cal__dow">{w}</span>)}
        </div>
        <div className="cal__grid mt-6">
          {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
          {Array.from({ length: days }, (_, i) => {
            const day = i + 1;
            const date = isoDay(month, day);
            const n = countOn(date);
            const future = date > today;
            return (
              <button
                key={date}
                type="button"
                className={`cal__day${date === today ? ' cal__day--today' : ''}${n > 0 ? ' cal__day--has' : ''}`}
                disabled={future}
                onClick={() => setOpenDate(date)}
                aria-label={`${shortDate(date)}${n > 0 ? `, ${n} ${n === 1 ? 'entry' : 'entries'}` : ''}`}
              >
                {day}
                {n > 0 && <span className="cal__count">{n}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {sorted.length > 0 && (
        <section aria-label="Entries to save">
          <div className="flex ai-c jc-sb">
            <h2 className="kicker m-0">{sorted.length} {sorted.length === 1 ? 'entry' : 'entries'} to save</h2>
            <span className="num fs-13 c-sec">{formatINR(totalPaise)}</span>
          </div>
          <ul className="list-reset grid gap-8 mt-8">
            {sorted.map(d => (
              <li key={d.id}>
                <Card variant="compact" className="flex ai-c jc-sb gap-8">
                  <div className="min-0">
                    <div className="fs-14 ellipsis ovh nowrap">{categoryName(d.categoryId)}</div>
                    <div className="fs-12 c-sec ellipsis ovh nowrap">{shortDate(d.date)} · {accountName(d.accountId)}{d.description ? ` · ${d.description}` : ''}</div>
                  </div>
                  <div className="flex ai-c gap-8 flex-none">
                    <span className="num fs-14">{formatINR(toPaise(d.amount))}</span>
                    <button type="button" className="iconbtn iconbtn--sm" onClick={() => setDrafts(list => list.filter(x => x.id !== d.id))} aria-label={`Remove ${categoryName(d.categoryId)} on ${shortDate(d.date)}`} disabled={saving}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {saveError && <p className="c-danger fs-13 m-0 mt-8" role="alert">{saveError}</p>}
          <Button block size="lg" className="mt-12" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving…' : `Save ${sorted.length} ${sorted.length === 1 ? 'entry' : 'entries'}`}
          </Button>
        </section>
      )}

      {openDate && (
        <EntrySheet
          date={openDate}
          accounts={accounts}
          categories={categories}
          startAccountId={startAccountId}
          onAdd={addDraft}
          onClose={() => setOpenDate(null)}
        />
      )}
    </section>
  );
}

function toPaise(amount: string): number {
  try {
    return parseRupeesToPaise(amount);
  } catch {
    return 0;
  }
}

/** The popup for one date: account (kept from the last entry), amount, category and an optional note. */
function EntrySheet({ date, accounts, categories, startAccountId, onAdd, onClose }: {
  date: string;
  accounts: Account[];
  categories: HomeData['categories'];
  startAccountId: string | null;
  onAdd: (d: Omit<Draft, 'id'>) => void;
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState<string | null>(startAccountId);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addedHere, setAddedHere] = useState(0);

  /** Returns true when the entry was valid and added. */
  function add(): boolean {
    setError(null);
    if (!accountId) return fail('Choose an account');
    if (toPaise(amount) <= 0) return fail('Enter an amount more than zero');
    if (!categoryId) return fail('Choose a category');
    onAdd({ date, accountId, amount, categoryId, description });
    return true;
  }
  function fail(message: string): false {
    setError(message);
    return false;
  }

  function addAndClose() {
    if (add()) onClose();
  }
  function addAnother() {
    if (!add()) return;
    haptic('tap');
    setAddedHere(n => n + 1);
    setAmount('');
    setCategoryId(null);
    setDescription('');
  }

  return (
    <Sheet label={`New entry for ${shortDate(date)}`} onClose={onClose}>
      <div className="flex ai-c jc-sb">
        <h2 className="fs-18 m-0">{shortDate(date)}</h2>
        {addedHere > 0 && <span className="fs-12 c-success">{addedHere} added</span>}
      </div>

      <fieldset className="chipset mt-14">
        <legend className="kicker">Account</legend>
        <div className="flex flex-wrap gap-8">
          {accounts.map(a => (
            <button key={a.id} type="button" className={`chip ${accountId === a.id ? 'chip--on' : ''}`} aria-pressed={accountId === a.id} onClick={() => setAccountId(a.id)}>{a.nickname}</button>
          ))}
        </div>
      </fieldset>

      <div className="mt-14">
        <Field label="Amount (₹)">
          <Input numeric inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" autoFocus />
        </Field>
      </div>

      {BUCKETS.map(b => {
        const list = categories.filter(c => c.bucket === b);
        if (list.length === 0) return null;
        return (
          <fieldset key={b} className="chipset mt-12">
            <legend className="kicker">{BUCKET_LABEL[b]}</legend>
            <div className="flex flex-wrap gap-8">
              {list.map(c => (
                <button key={c.id} type="button" className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>{c.name}</button>
              ))}
            </div>
          </fieldset>
        );
      })}

      <div className="mt-12">
        <Field label="Note (optional)">
          <Input value={description} onChange={e => setDescription(e.target.value)} maxLength={120} />
        </Field>
      </div>

      {error && <p className="c-danger fs-13 m-0 mt-8" role="alert">{error}</p>}
      <div className="flex gap-8 mt-14">
        <Button variant="secondary" block onClick={addAnother}>Add &amp; another</Button>
        <Button block onClick={addAndClose}>Add entry</Button>
      </div>
    </Sheet>
  );
}
