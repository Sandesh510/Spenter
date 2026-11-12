import { useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { formatINR } from '../lib/money';
import { BUCKET_LABEL, categoryIcon } from '../lib/categories';
import { currentMonth, dayOfMonth, daysInMonth, monthTitle, shiftMonth, todayIST } from '../lib/dates';
import { dailyAllowance } from '../lib/dailyAllowance';
import { useAmountsShown } from '../lib/amountVisibility';
import { useApi } from '../lib/useApi';
import type { Bucket, Category, CommitmentsData, HomeBucket, HomeData, AskItem, Loan, InsurancePolicy } from '../lib/types';
import { CategoryTile } from '../components/ui/CategoryTile';
import { Badge } from '../components/ui/Badge';
import { InsuranceReminders } from './Insurance';
import { SavingsCard } from './Savings';
import { NetWorthCard } from './NetWorth';
import { OutlookCard } from './Outlook';
import type { Route } from '../App';

/**
 * Home, per screens/ScreenHome.dc.html. Bucket colour rules come from the README.
 * The month can be stepped back to earlier months; the current month cannot be passed.
 */
export function Home({ token, go, onOpenCategory, onOpenBucket, onPayCard }: {
  token: string;
  go: (r: Route) => void;
  onOpenCategory: (categoryId: string, month: string) => void;
  onOpenBucket: (bucket: Bucket, month: string) => void;
  onPayCard: () => void;
}) {
  const today = currentMonth();
  const [month, setMonth] = useState(today);
  const [shown, toggleShown, money] = useAmountsShown();
  const isCurrent = month === today;
  const { data, error, reload } = useApi<HomeData>(`home?month=${month}`, token);
  const insurance = useApi<{ items: InsurancePolicy[] }>('insurance', token);

  if (error) return <div className="scroll c-danger" role="alert">{error}</div>;
  if (!data) return <div className="scroll c-sec">Loading…</div>;

  const spent = data.spendPaise + data.savingsPaise;
  const progress = data.openingPaise > 0 ? Math.min(1, spent / data.openingPaise) : 0;

  return (
    <div className="scroll">
      <div className="home-head">
        <div className="flex ai-c gap-8">
          <button className="iconbtn" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month">
            <Icon name="chevron-left" size={18} />
          </button>
          <div>
            <div className="kicker kicker--amber">{isCurrent ? 'This month' : 'Past month'}</div>
            <h1 className="heading fs-22 mt-2 lh-tight">{monthTitle(month)}</h1>
          </div>
          <button className="iconbtn" onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month" disabled={isCurrent}>
            <Icon name="chevron-right" size={18} />
          </button>
        </div>
        <button className="iconbtn" onClick={() => go('settings')} aria-label="Settings">
          <Icon name="user" size={19} />
        </button>
      </div>

      {!data.decided && <OpeningDecision token={token} month={month} suggested={data.suggestedOpening ?? null} onDone={reload} />}

      <Card as="section" className="mt-12 home-hero">
        <div className="flex ai-c jc-sb">
          <span className="fs-12 c-sec">Balance left to spend</span>
          <button className="iconbtn iconbtn--sm" onClick={toggleShown} aria-pressed={shown} aria-label={shown ? 'Hide amounts' : 'Show amounts'}>
            <Icon name={shown ? 'eye' : 'eye-off'} size={15} />
          </button>
        </div>
        <div className="home-hero__row">
          <div className={`heading num fs-34 home-hero__amount${shown && data.spendableBalancePaise < 0 ? ' c-danger' : ''}`}>
            {money(data.spendableBalancePaise)}
          </div>
          {isCurrent && (
            <div className="home-hero__safe num">
              <div className="fs-11 c-sec">Safe to spend</div>
              <div className={`fs-18 ${(data.safeToSpendPaise ?? data.spendableBalancePaise) < 0 ? 'c-danger' : 'c-text'}`}>{formatINR(data.safeToSpendPaise ?? data.spendableBalancePaise)}</div>
            </div>
          )}
        </div>
        <div className="track track--thin">
          <div className="fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="num fs-12 c-sec m-0 mt-8">
          Started <span className="c-text">{data.hasOpening ? money(data.openingPaise) : 'none'}</span> · Spent <span className="c-text">{formatINR(spent)}</span>
        </p>
        {data.card && (data.card.duePaise > 0 || data.card.paidPaise > 0 || (data.card.carriedPaise ?? 0) > 0) && <CardDue card={data.card} balancePaise={data.spendableBalancePaise} money={money} shown={shown} onPay={onPayCard} />}
        {isCurrent && <SafeNote safePaise={data.safeToSpendPaise ?? data.spendableBalancePaise} bills={data.upcomingBills ?? []} />}
      </Card>

      <div className="section-head">
        <h2 className="kicker m-0">Budgets</h2>
        <span className="kicker num">{isCurrent ? `day ${dayOfMonth()} / ${daysInMonth(month)}` : `${daysInMonth(month)} days`}</span>
      </div>
      <div className="flex gap-18" style={{ flexDirection: 'column' }}>
        {data.buckets.map(b => (
          <BudgetBar key={b.bucket} b={b} onOpen={() => onOpenBucket(b.bucket as Bucket, month)} />
        ))}
      </div>

      <CategorySpend categories={data.categories} onOpen={id => onOpenCategory(id, month)} />

      <div className="section-head"><h2 className="kicker m-0">Your money</h2></div>
      <Card as="button" onClick={() => go('lent')} className="card--link card--row">
        <span className="fs-13 c-sec">Money lent · yet to get back</span>
        <span className="num flex ai-c gap-6">
          <LentTotal token={token} />
          <Icon name="chevron-right" size={16} />
        </span>
      </Card>

      <CommitmentsCard token={token} onOpen={() => go('commitments')} />
      <SavingsCard token={token} onOpen={() => go('savings')} />
      <NetWorthCard token={token} onOpen={() => go('networth')} />
      <OutlookCard token={token} onOpen={() => go('outlook')} />

      <InsuranceReminders policies={insurance.data?.items ?? []} onOpen={() => go('commitments')} />



      <div className="section-head">
        <h2 className="kicker m-0">Recent asks</h2>
        <button className="link flex ai-c gap-2" onClick={() => go('log')}>
          See all <Icon name="chevron-right" size={14} />
        </button>
      </div>
      {data.asks.length === 0 ? (
        <p className="fs-13 c-sec" style={{ margin: 0 }}>No decisions yet. Tap the centre button to check a purchase.</p>
      ) : (
        <div>{data.asks.map(a => <AskRow key={a.id} a={a} />)}</div>
      )}
    </div>
  );
}

/**
 * Asked once per month: add a starting balance, or mark the month as having none.
 * Nothing carries over by itself: last month's closing balance is only offered, and the user chooses it.
 */
function OpeningDecision({ token, month, suggested, onDone }: { token: string; month: string; suggested: { month: string; paise: number } | null; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(body: { amount: string } | { none: true }) {
    setError(null);
    setBusy(true);
    try {
      await api('month-opening', { token, body: { month, ...body } });
      haptic('success');
      onDone();
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="mt-12">
      <div className="kicker">Starting balance</div>
      <p className="fs-13 c-sec" style={{ margin: '6px 0 12px' }}>
        Set a starting balance for {monthTitle(month)}: the cash in your bank, savings and wallet accounts, not counting credit cards. Card bills still owed are taken off it for you. Or choose none. {suggested ? 'Nothing carries over unless you choose it.' : 'Nothing carries over from the previous month.'}
      </p>
      {suggested && (
        <Button block disabled={busy} onClick={() => decide({ amount: (suggested.paise / 100).toFixed(2) })}>
          Use {formatINR(suggested.paise)} · {monthTitle(suggested.month).split(' ')[0]} closing balance
        </Button>
      )}
      <form className={`flex gap-8${suggested ? ' mt-12' : ''}`} onSubmit={e => { e.preventDefault(); decide({ amount }); }}>
        <Input numeric inputMode="decimal" placeholder="Amount, e.g. 92400" value={amount} onChange={e => setAmount(e.target.value)} required aria-label="Starting balance" />
        <Button type="submit" size="sm" disabled={busy}>Save</Button>
      </form>
      <Button variant="secondary" block className="mt-8" disabled={busy} onClick={() => decide({ none: true })}>
        No starting balance this month
      </Button>
      {error && <p className="c-danger fs-13 mt-8" role="alert">{error}</p>}
    </Card>
  );
}

/** Colour rules from the README: green ≤90% of plan, amber 90–100%, red over. Savings is blue until the goal is met. */
function BudgetBar({ b, onOpen }: { b: HomeBucket; onOpen: () => void }) {
  const ratio = b.plannedPaise > 0 ? b.spentPaise / b.plannedPaise : 0;
  const isSave = b.bucket === 'save';
  const left = b.plannedPaise - b.spentPaise;
  const over = b.hasBudget && !isSave && ratio > 1;

  let color = 'var(--color-success)';
  if (isSave) color = ratio >= 1 ? 'var(--color-success)' : 'var(--color-need)';
  else if (over) color = 'var(--color-danger)';
  else if (ratio > 0.9) color = 'var(--color-accent)';

  let note = '';
  let noteColor = color;
  if (!b.hasBudget) {
    note = '';
  } else if (isSave) {
    note = ratio >= 1 ? 'goal met' : `${formatINR(left)} to go`;
  } else if (over) {
    note = `${formatINR(-left)} over`;
  } else {
    note = `${formatINR(left)} left${ratio > 0.9 ? ' · tight' : ''}`;
  }
  const sub = !b.hasBudget ? 'no plan set' : isSave ? `${Math.round(ratio * 100)}% of goal` : `${Math.round(ratio * 100)}% of plan`;
  const pct = Math.min(1, ratio);

  return (
    <button className="budget-bar" onClick={onOpen} aria-label={`${BUCKET_LABEL[b.bucket as Bucket]}: show transactions`}>
      <div className="flex jc-sb ai-base">
        <span className="fs-14 c-text">{BUCKET_LABEL[b.bucket as Bucket]}</span>
        <span className="num fs-12 c-sec">
          <span className="c-text">{formatINR(b.spentPaise)}</span> / {b.hasBudget ? formatINR(b.plannedPaise) : '—'}
        </span>
      </div>
      <div className="track track--thin">
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 6 }} />
      </div>
      <div className="flex jc-sb fs-11 c-sec">
        <span>{sub}</span>
        {note && <span className="num" style={{ color: noteColor }}>{note}</span>}
      </div>
    </button>
  );
}

function AskRow({ a }: { a: AskItem }) {
  const v = {
    bought: { icon: 'check', bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: 'Bought' },
    skipped: { icon: 'x', bg: 'var(--color-danger-bg)', color: 'var(--color-danger)', label: 'Skipped' },
    delayed: { icon: 'clock', bg: 'var(--color-accent-tint)', color: 'var(--color-accent-text)', label: 'Delayed' },
  }[a.decision];

  return (
    <div className="row" style={{ padding: '11px 4px' }}>
      <div className="flex-none grid" style={{ width: 34, height: 34, borderRadius: '50%', placeItems: 'center', background: v.bg, color: v.color }}>
        <Icon name={v.icon} size={17} />
      </div>
      <div className="flex-1 min-0">
        <div className="fs-14 nowrap ovh ellipsis">{a.item}</div>
        <div className="fs-12 c-sec" style={{ marginTop: 1 }}>{v.label} · {a.categoryName ?? 'No category'}</div>
      </div>
      <div className="num fs-14">{formatINR(a.amountPaise)}</div>
    </div>
  );
}

/** This month's subscriptions, SIPs and EMIs. Each posts on its day; the card opens the full view. */
function CommitmentsCard({ token, onOpen }: { token: string; onOpen: () => void }) {
  const { data } = useApi<CommitmentsData>('commitments', token);
  const t = data?.totals;
  return (
    <Card as="button" onClick={onOpen} className="card--link">
      <div className="flex ai-c jc-sb">
        <span className="fs-13 c-sec">Commitments · every month</span>
        <Icon name="chevron-right" size={16} />
      </div>
      <div className="num fs-12 c-sec mt-8 flex jc-sb">
        <span>Subs <span className="c-text">{formatINR(t?.subscriptionsPaise ?? 0)}</span></span>
        <span>SIP <span className="c-text">{formatINR(t?.investmentsPaise ?? 0)}</span></span>
        <span>EMI <span className="c-text">{formatINR(t?.emisPaise ?? 0)}</span></span>
      </div>
    </Card>
  );
}

/** Total still owed to you: each loan's outstanding amount, after Got back credits. */
function LentTotal({ token }: { token: string }) {
  const { data } = useApi<{ items: Loan[] }>('lent', token);
  const total = (data?.items ?? []).reduce((s, l) => s + l.outstanding_paise, 0);
  return <span>{formatINR(total)}</span>;
}

/** Categories listed before "Show all", so the rest of Home stays within reach. */
const TOP_CATEGORIES = 5;

/**
 * This month's categories with spending or a plan. Over-budget categories come first and are marked; only the top 5 show until "Show all".
 * Tapping one opens the Log filtered to that category and month.
 */
function CategorySpend({ categories, onOpen }: { categories: Category[]; onOpen: (categoryId: string) => void }) {
  const [all, setAll] = useState(false);
  // Savings above plan means the goal is met, so only Needs and Wants can be over budget.
  const over = (c: Category) => c.bucket !== 'save' && c.plannedPaise !== null && c.plannedPaise > 0 && c.spentPaise > c.plannedPaise;
  // Near the limit: 80% of the plan or more, the same line the budget alerts used.
  const near = (c: Category) => c.bucket !== 'save' && !over(c) && c.plannedPaise !== null && c.plannedPaise > 0 && c.spentPaise / c.plannedPaise >= 0.8;
  const shown = categories
    .filter(c => c.spentPaise > 0 || over(c))
    .sort((a, b) => Number(over(b)) - Number(over(a)) || Number(near(b)) - Number(near(a)) || b.spentPaise - a.spentPaise);
  if (shown.length === 0) return null;
  const overCount = shown.filter(over).length;
  const nearCount = shown.filter(near).length;
  const visible = all ? shown : shown.slice(0, TOP_CATEGORIES);

  return (
    <section aria-labelledby="home-categories">
      <div className="section-head">
        <h2 id="home-categories" className="kicker m-0">Categories</h2>
        {(overCount > 0 || nearCount > 0) && (
          <span className={`kicker ${overCount > 0 ? 'c-danger' : 'c-warning'}`}>
            {[overCount > 0 ? `${overCount} over` : '', nearCount > 0 ? `${nearCount} near limit` : ''].filter(Boolean).join(' · ')}
          </span>
        )}
      </div>
      <Card variant="group">
        <ul className="list-reset">
          {visible.map(c => (
            <li key={c.id}>
              <button className="list-row" onClick={() => onOpen(c.id)} aria-label={`${c.name}: show transactions`}>
                <CategoryTile icon={categoryIcon(c)} bucket={c.bucket} />
                <span className="flex-1 min-0">
                  <span className="fs-14 nowrap ovh ellipsis" style={{ display: 'block' }}>{c.name}</span>
                  <span className="num fs-12 c-sec">
                    {formatINR(c.spentPaise)}{c.plannedPaise ? ` of ${formatINR(c.plannedPaise)}` : ' · no plan'}
                  </span>
                </span>
                {over(c) && c.plannedPaise !== null && <span className="c-danger fs-12 num">{formatINR(c.spentPaise - c.plannedPaise)} over</span>}
                {c.bucket === 'save' && c.plannedPaise !== null && c.plannedPaise > 0 && c.spentPaise >= c.plannedPaise && <Badge tone="success">goal met</Badge>}
                {near(c) && <Badge tone="neutral">{Math.round((c.spentPaise / (c.plannedPaise as number)) * 100)}% used</Badge>}
                <span className="c-mut"><Icon name="chevron-right" size={15} /></span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {shown.length > TOP_CATEGORIES && (
        <button className="link link--block mt-8" onClick={() => setAll(a => !a)} aria-expanded={all}>
          {all ? 'Show top 5 only' : `Show all ${shown.length} categories`}
        </button>
      )}
    </section>
  );
}

/**
 * The same money seen from the accounts: what they hold before the card bill, the card bill itself,
 * and what is left once it is paid. Balance left to spend already has the card use taken out.
 */
function CardDue({ card, balancePaise, money, shown, onPay }: { card: NonNullable<HomeData['card']>; balancePaise: number; money: (p: number) => string; shown: boolean; onPay: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="safe mt-8">
      <dl className="home-split num m-0">
        <div>
          <dt className="fs-11 c-sec">In your accounts</dt>
          <dd className="fs-15 m-0">{money(balancePaise + card.duePaise)}</dd>
        </div>
        <div>
          <dt className="fs-11 c-sec">Card owed</dt>
          <dd className="fs-15 m-0 flex ai-c gap-8">
            {money(card.duePaise)}
            {card.duePaise > 0 && <button className="link fs-13" onClick={onPay}>Pay</button>}
            <button className="iconbtn iconbtn--sm" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? 'Hide card details' : 'Show card details'}>
              <Icon name={open ? 'chevron-up' : 'chevron-down'} size={15} />
            </button>
          </dd>
        </div>
      </dl>
      {open && (
        <>
          <dl className="num grid gap-4 fs-13 m-0 mt-8">
            {(card.carriedPaise ?? 0) > 0 && <div className="flex jc-sb"><dt className="c-sec">Owed from earlier months</dt><dd className="m-0">{money(card.carriedPaise ?? 0)}</dd></div>}
            {(card.otherPaise ?? 0) > 0 && <div className="flex jc-sb"><dt className="c-sec">Of which money lent</dt><dd className="m-0">{money(card.otherPaise ?? 0)}</dd></div>}
            {card.paidPaise > 0 && <div className="flex jc-sb"><dt className="c-sec">Card bills paid this month</dt><dd className="m-0">{money(card.paidPaise)}</dd></div>}
            <div className="flex jc-sb"><dt className="c-text">Left after the card bill</dt><dd className={`m-0 ${shown && balancePaise < 0 ? 'c-danger' : 'c-text'}`}>{money(balancePaise)}</dd></div>
          </dl>
          {card.duePaise > 0 && <p className="fs-12 c-mut m-0 mt-8">The bill can be paid from next month’s money. It is already taken out of the balance above.</p>}
        </>
      )}
    </div>
  );
}

/**
 * The line under the balance: what Safe to spend allows a day, and the bills still due this month.
 * Safe to spend is the balance less subscriptions, SIPs, EMIs and premiums still due. The bills open on tap.
 */
function SafeNote({ safePaise, bills }: { safePaise: number; bills: NonNullable<HomeData['upcomingBills']> }) {
  const [open, setOpen] = useState(false);
  const total = bills.reduce((s, b) => s + b.amountPaise, 0);
  const perDay = dailyAllowance(safePaise, todayIST());
  return (
    <div className="safe mt-8">
      <div className="flex ai-c jc-sb gap-8 fs-12 c-sec">
        <span>{perDay ? <>About <span className="num c-text">{formatINR(perDay.perDayPaise)}</span> a day{perDay.daysLeft > 1 ? ` for ${perDay.daysLeft} days` : ' today'}</> : 'Safe to spend'}</span>
        {bills.length === 0 ? (
          <span className="c-mut">No bills due</span>
        ) : (
          <button className="link fs-12 flex ai-c gap-4" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            {formatINR(total)} bills due
            <Icon name={open ? 'chevron-down' : 'chevron-right'} size={13} />
          </button>
        )}
      </div>
      {open && (
        <ul className="list-reset grid gap-4 fs-12 mt-8">
          {bills.map(b => (
            <li key={`${b.name}-${b.dueOn}`} className="flex jc-sb">
              <span className="c-sec">{b.name} · {b.dueOn.slice(8)} {monthTitle(b.dueOn.slice(0, 7)).slice(0, 3)}</span>
              <span className="num">{formatINR(b.amountPaise)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
