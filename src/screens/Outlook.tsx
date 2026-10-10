import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { useAmountsShown } from '../lib/amountVisibility';
import { cache } from '../lib/cache';
import { daysBetween, dayIn } from '../lib/cardCycle';
import { cashOutlook, type CardInput, type Outlook as OutlookResult } from '../lib/cashOutlook';
import { currentMonth, shiftMonth, todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { isCreditCard } from '../lib/accountTypes';
import { paiseToPlain } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, HomeData, Loan, Profile, TxnRow } from '../lib/types';
import type { Route } from '../App';

/** Builds the cash outlook from what is already tracked. Null until everything has loaded. */
export function useOutlook(token: string): { outlook: OutlookResult; profile: Profile } | null {
  const month = currentMonth();
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const profile = useApi<Profile>('profile', token);
  const home = useApi<HomeData>(`home?month=${month}`, token);
  const thisTxns = useApi<{ items: TxnRow[] }>(`transactions?month=${month}`, token);
  const lastTxns = useApi<{ items: TxnRow[] }>(`transactions?month=${shiftMonth(month, -1)}`, token);
  const lent = useApi<{ items: Loan[] }>('lent', token);
  if (!accounts.data || !profile.data || !home.data || !thisTxns.data || !lastTxns.data || !lent.data) return null;

  const items = accounts.data.items;
  const cardIds = new Set(items.filter(a => isCreditCard(a.kind)).map(a => a.id));
  const txns = [...thisTxns.data.items, ...lastTxns.data.items];

  const cards: CardInput[] = items
    .filter(a => cardIds.has(a.id))
    .map(a => {
      const charges: CardInput['charges'] = [];
      for (const t of txns) {
        if (t.type === 'spend' && t.account_id === a.id) charges.push({ date: t.txn_date, paise: t.amount_paise });
        // Money moved out of the card to somewhere that is not a card is owed too.
        else if (t.type === 'transfer' && t.account_id === a.id && !(t.to_account_id && cardIds.has(t.to_account_id))) charges.push({ date: t.txn_date, paise: t.amount_paise });
      }
      for (const l of lent.data?.items ?? []) if (l.debit_account_id === a.id) charges.push({ date: l.lent_on, paise: l.amount_paise });
      const balance = a.balance_paise ?? null;
      return {
        id: a.id,
        nickname: a.nickname,
        limitPaise: a.credit_limit_paise ?? null,
        owedPaise: balance === null ? null : Math.max(0, -balance),
        statementDay: a.statement_day ?? null,
        dueDay: a.due_day ?? null,
        charges,
      };
    });

  const outlook = cashOutlook({
    today: todayIST(),
    cashBalances: items.filter(a => !cardIds.has(a.id) && a.balance_paise != null).map(a => a.balance_paise as number),
    cards,
    billsPaise: (home.data.upcomingBills ?? []).reduce((s, b) => s + b.amountPaise, 0),
    expectedIncomePaise: profile.data.expectedIncomePaise ?? null,
    incomeDay: profile.data.incomeDay ?? null,
  });
  return { outlook, profile: profile.data };
}

/** Home card: about how much more could go on the cards and still be paid on time. */
export function OutlookCard({ token, onOpen }: { token: string; onOpen: () => void }) {
  const result = useOutlook(token);
  const [, , money] = useAmountsShown();
  const o = result?.outlook;
  return (
    <Card as="button" onClick={onOpen} className="card--link">
      <div className="flex ai-c jc-sb">
        <span className="fs-13 c-sec">Cash outlook</span>
        <Icon name="chevron-right" size={16} />
      </div>
      <p className="fs-12 c-sec m-0 mt-8">
        {!o
          ? '…'
          : o.canPutOnCardsPaise === null
            ? 'Add your card bill and due days to see how much you can roll.'
            : <>Can put about <span className="num c-text">{money(o.canPutOnCardsPaise)}</span> more on cards and pay on time</>}
      </p>
    </Card>
  );
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "in 15 days", "today", "3 days ago". */
function inDays(from: string, to: string): string {
  const n = daysBetween(from, to);
  return n === 0 ? 'today' : n > 0 ? `in ${n} ${n === 1 ? 'day' : 'days'}` : `${-n} ${n === -1 ? 'day' : 'days'} ago`;
}

export function Outlook({ token, go, onPayCard }: { token: string; go: (r: Route) => void; onPayCard: (cardId: string) => void }) {
  const result = useOutlook(token);
  const [shown, toggleShown, money] = useAmountsShown();
  const today = todayIST();

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back to Home"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Cash outlook</h1>
        <button className="iconbtn" onClick={toggleShown} aria-pressed={shown} aria-label={shown ? 'Hide amounts' : 'Show amounts'}>
          <Icon name={shown ? 'eye' : 'eye-off'} size={16} />
        </button>
      </div>

      {!result && <p className="fs-13 c-sec mt-12">Loading…</p>}

      {result && (
        <>
          <Card as="section" className="mt-8" aria-label="Free money">
            <div className="fs-12 c-sec">Yours after the cards and bills</div>
            <div className={`heading num fs-44 mt-4 nw-total${shown && result.outlook.freePaise < 0 ? ' c-danger' : ''}`}>{money(result.outlook.freePaise)}</div>
            <dl className="num grid gap-4 fs-13 m-0 mt-12">
              <div className="flex jc-sb"><dt className="c-sec">In your accounts</dt><dd className="m-0">{money(result.outlook.cashPaise)}</dd></div>
              <div className="flex jc-sb"><dt className="c-sec">Cards owe</dt><dd className="m-0">− {money(result.outlook.owedPaise)}</dd></div>
              <div className="flex jc-sb"><dt className="c-sec">Bills still due this month</dt><dd className="m-0">− {money(result.outlook.billsPaise)}</dd></div>
            </dl>
            {result.outlook.cardsWithoutBalance.length > 0 && (
              <p className="fs-12 c-sec m-0 mt-8">
                Not counted: {result.outlook.cardsWithoutBalance.join(', ')} (no opening balance). Set what it owes in Settings, Accounts.
              </p>
            )}
          </Card>

          <Rolling outlook={result.outlook} money={money} expectedIncome={result.profile.expectedIncomePaise ?? null} />

          <h2 className="kicker mt-20 m-0">Your cards</h2>
          {result.outlook.cards.length === 0 && <p className="fs-13 c-sec mt-8">No credit card yet. Add one in Settings, Accounts.</p>}
          <ul className="list-reset grid gap-12 mt-8">
            {result.outlook.cards.map(c => (
              <li key={c.id}>
                <Card as="section" variant="compact" aria-label={c.nickname}>
                  <div className="flex ai-base jc-sb">
                    <h3 className="fs-15 m-0">{c.nickname}</h3>
                    <span className="num fs-13">{c.owedPaise === null ? 'no balance set' : `Owed ${money(c.owedPaise)}`}</span>
                  </div>
                  <button className="link" onClick={() => onPayCard(c.id)}>Pay bill</button>
                  {c.limitPaise !== null && c.usedPct !== null && (
                    <>
                      <div className="track mt-8"><div className="fill" style={{ width: `${Math.min(100, Math.max(0, c.usedPct))}%` }} /></div>
                      <p className="num fs-12 c-sec m-0 mt-4">
                        {c.usedPct}% of {money(c.limitPaise)} used · {c.availablePaise !== null && c.availablePaise < 0 ? `${money(-c.availablePaise)} over the limit` : `${money(c.availablePaise ?? 0)} left`}
                      </p>
                    </>
                  )}
                  {c.limitPaise === null && <p className="fs-12 c-mut m-0 mt-4">Add a credit limit in Settings, Accounts to see credit left.</p>}
                  {c.nextStatement === null ? (
                    <p className="fs-12 c-mut m-0 mt-8">Add the day the bill is generated and the day it is due in Settings, Accounts.</p>
                  ) : (
                    <dl className="num grid gap-4 fs-12 m-0 mt-8">
                      {c.billedPaise !== null && c.billedPaise > 0 && c.billDue && (
                        <div className="flex jc-sb">
                          <dt className={c.billOverdue ? 'c-danger' : 'c-sec'}>Bill {c.billOverdue ? 'overdue since' : 'due'} {dateLabel(c.billDue)} ({inDays(today, c.billDue)})</dt>
                          <dd className={`m-0 ${c.billOverdue ? 'c-danger' : ''}`}>{money(c.billedPaise)}</dd>
                        </div>
                      )}
                      {c.billedPaise === 0 && <div className="flex jc-sb"><dt className="c-sec">Last bill</dt><dd className="m-0 c-success">paid</dd></div>}
                      <div className="flex jc-sb">
                        <dt className="c-sec">Since the last bill, on the {dateLabel(c.nextStatement)} bill</dt>
                        <dd className="m-0">{money(c.unbilledPaise ?? 0)}</dd>
                      </div>
                      {c.newPurchaseDue && <div className="flex jc-sb"><dt className="c-mut">A purchase today is due</dt><dd className="m-0 c-mut">{dateLabel(c.newPurchaseDue)}</dd></div>}
                    </dl>
                  )}
                </Card>
              </li>
            ))}
          </ul>

          <IncomeForm token={token} profile={result.profile} />

          <p className="fs-12 c-mut m-0 mt-16">
            An estimate from what you have entered, not a promise. It counts this month's bills only, assumes your income arrives on its usual day, and leaves your savings plans alone.
          </p>
        </>
      )}
    </div>
  );
}

/** The figure the screen is for: how much more could go on cards and still be paid by the due date. */
function Rolling({ outlook, money, expectedIncome }: { outlook: OutlookResult; money: (p: number) => string; expectedIncome: number | null }) {
  const credit = outlook.cards.reduce((s, c) => s + (c.availablePaise ?? 0), 0);
  return (
    <Card as="section" className="mt-12" aria-label="Rolling on cards">
      <h2 className="kicker kicker--spaced m-0">What you can roll</h2>
      {outlook.canPutOnCardsPaise === null || !outlook.horizon ? (
        <p className="fs-13 c-sec m-0 mt-8">Add a bill day and a due day to a card in Settings, Accounts, and this shows how much more you can put on cards and still pay on time.</p>
      ) : (
        <>
          <div className="num fs-22 mt-8">{money(outlook.canPutOnCardsPaise)}</div>
          <p className="fs-12 c-sec m-0 mt-2">more on cards, and still paid by {dateLabel(outlook.horizon)}, the earliest a new purchase falls due</p>
          <dl className="num grid gap-4 fs-12 m-0 mt-12">
            <div className="flex jc-sb"><dt className="c-sec">Yours after cards and bills</dt><dd className="m-0">{money(outlook.freePaise)}</dd></div>
            <div className="flex jc-sb"><dt className="c-sec">Income expected before then</dt><dd className="m-0">+ {money(outlook.incomeBeforeHorizonPaise)}</dd></div>
            {!outlook.limitUnknown && <div className="flex jc-sb"><dt className="c-sec">Credit left on cards (the cap)</dt><dd className="m-0">{money(credit)}</dd></div>}
          </dl>
          {expectedIncome === null && <p className="fs-12 c-mut m-0 mt-8">Add your expected income below to count what arrives before the due date.</p>}
          {outlook.limitUnknown && <p className="fs-12 c-mut m-0 mt-8">No credit limit is set, so this is not capped by credit left.</p>}
        </>
      )}
    </Card>
  );
}

/** A rough monthly income and the day it usually arrives. Used only for the outlook. */
function IncomeForm({ token, profile }: { token: string; profile: Profile }) {
  const [amount, setAmount] = useState(profile.expectedIncomePaise ? paiseToPlain(profile.expectedIncomePaise).replace(/\.00$/, '') : '');
  const [day, setDay] = useState(profile.incomeDay ? String(profile.incomeDay) : '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const next = profile.incomeDay ? nextIncome(todayIST(), profile.incomeDay) : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      await api('profile', { method: 'PATCH', token, body: { expectedIncome: amount.trim(), incomeDay: day.trim() } });
      cache.set('profile', await api<Profile>('profile', { token }));
      haptic('success');
      setMsg({ ok: true, text: 'Saved' });
    } catch (err) {
      haptic('error');
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not save' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="mt-20" aria-label="Expected income">
      <h2 className="kicker kicker--spaced m-0">Expected income</h2>
      <p className="fs-12 c-sec m-0 mt-2">A rough monthly figure, such as your salary. {next ? `Next on ${dateLabel(next)}.` : ''}</p>
      <form className="grid gap-12 mt-12" onSubmit={save}>
        <div className="grid-2 gap-12">
          <Field label="Each month (₹)">
            <Input className="fs-15" numeric inputMode="decimal" placeholder="e.g. 60000" value={amount} onChange={e => setAmount(e.target.value)} maxLength={14} />
          </Field>
          <Field label="Usually on (day)">
            <Input className="fs-15" numeric inputMode="numeric" placeholder="e.g. 1" value={day} onChange={e => setDay(e.target.value)} maxLength={2} />
          </Field>
        </div>
        {msg && <p className={`fs-13 m-0 ${msg.ok ? 'c-success' : 'c-danger'}`} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
        <Button type="submit" variant="secondary" disabled={busy}>{busy ? 'Saving…' : 'Save income'}</Button>
      </form>
    </Card>
  );
}

/** The next date the income day comes round, after today. */
function nextIncome(today: string, day: number): string {
  const thisMonth = dayIn(today.slice(0, 7), day);
  return thisMonth > today ? thisMonth : dayIn(shiftMonth(today.slice(0, 7), 1), day);
}
