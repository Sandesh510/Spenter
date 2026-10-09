import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icon';
import { categoryIcon } from '../lib/categories';
import { currentMonth, monthTitle } from '../lib/dates';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, Bucket, Category, HomeData, MoneyIn, MoneyOut } from '../lib/types';

const TARGET: Record<Bucket, number> = { need: 50, want: 30, save: 20 };
const LABEL: Record<Bucket, string> = { need: 'Needs', want: 'Wants', save: 'Savings' };
const COLOUR: Record<Bucket, string> = { need: 'var(--color-need)', want: 'var(--color-accent)', save: 'var(--color-success)' };

/** Monthly summary, per screens/ScreenSummary.dc.html. Every figure is computed from the month's data. */
export function Trends({ token }: { token: string }) {
  const month = currentMonth();
  const { data, error } = useApi<HomeData>(`home?month=${month}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);

  if (error) return <div className="scroll c-danger" role="alert">{error}</div>;
  if (!data) return <div className="scroll c-sec">Loading…</div>;

  const bucketSpent = (b: Bucket) => data.buckets.find(x => x.bucket === b)?.spentPaise ?? 0;
  const total = (['need', 'want', 'save'] as Bucket[]).reduce((s, b) => s + bucketSpent(b), 0);
  const share = (b: Bucket) => (total > 0 ? Math.round((bucketSpent(b) / total) * 100) : 0);
  const needPct = share('need');
  const wantPct = share('want');
  const savePct = 100 - needPct - wantPct;
  const pct: Record<Bucket, number> = { need: needPct, want: wantPct, save: total > 0 ? savePct : 0 };

  const worst = (['need', 'want', 'save'] as Bucket[]).reduce((w, b) => (Math.abs(pct[b] - TARGET[b]) > Math.abs(pct[w] - TARGET[w]) ? b : w), 'need' as Bucket);
  const gap = Math.abs(pct[worst] - TARGET[worst]);
  const caption = total === 0 ? 'No spending yet this month' : gap <= 5 ? 'Close to your 50 / 30 / 20 target' : `${LABEL[worst]} is ${pct[worst] - TARGET[worst] > 0 ? 'above' : 'below'} its ${TARGET[worst]}% target by ${gap} points`;

  const bars = data.categories.filter(c => (c.plannedPaise ?? 0) > 0 || c.spentPaise > 0);
  const maxValue = Math.max(1, ...bars.map(c => Math.max(c.plannedPaise ?? 0, c.spentPaise)));

  const patterns = buildPatterns(data.categories, data.buckets);

  return (
    <div className="scroll">
      <div className="flex ai-c jc-sb" style={{ margin: '8px 0 8px' }}>
        <h1 className="heading fs-24">{monthTitle(month).split(' ')[0]}</h1>
        <span className="fs-12 c-sec">This month</span>
      </div>

      <MoneyFlow moneyIn={data.moneyIn} moneyOut={data.moneyOut} />

      {data.card && (data.card.spentPaise > 0 || data.card.duePaise > 0) && <CreditCardSection card={data.card} categories={data.categories} />}

      <Card className="flex ai-c gap-18 mt-16" as="section" style={{ padding: 18 }}>
        <div className="rel flex-none" style={{ width: 120, height: 120 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: total > 0
                ? `conic-gradient(${COLOUR.need} 0 ${needPct}%, ${COLOUR.want} ${needPct}% ${needPct + wantPct}%, ${COLOUR.save} ${needPct + wantPct}% 100%)`
                : 'var(--color-surface-muted)',
            }}
          />
          <div className="abs grid ta-c" style={{ inset: 19, borderRadius: '50%', background: 'var(--color-surface)', placeItems: 'center' }}>
            <div>
              <div className="heading num fs-18" style={{ lineHeight: 1 }}>{formatK(total)}</div>
              <div className="fs-11 c-sec" style={{ marginTop: 1 }}>spent</div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex" style={{ flexDirection: 'column', gap: 11 }}>
          {(['need', 'want', 'save'] as Bucket[]).map(b => (
            <div className="flex ai-c" key={b} style={{ gap: 9 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOUR[b] }} />
              <span className="fs-13 flex-1">{LABEL[b]}</span>
              <span className="num fs-13">{pct[b]}%</span>
              <span className="num fs-11 ta-r" style={{ color: Math.abs(pct[b] - TARGET[b]) <= 5 ? 'var(--color-success)' : 'var(--color-text-muted)', width: 34 }}>/ {TARGET[b]}</span>
            </div>
          ))}
        </div>
      </Card>
      <div className="ta-c fs-12 c-sec" style={{ margin: '9px 0 0' }}>{caption}</div>

      {(data.byAccount?.length ?? 0) > 0 && <AccountChart rows={data.byAccount ?? []} accounts={accounts.data?.items ?? []} />}

      <div className="flex jc-sb ai-c" style={{ margin: '24px 2px 14px' }}>
        <span className="kicker">Planned vs actual</span>
        <span className="flex gap-10 fs-11">
          <span className="c-mut">▬ plan</span>
          <span className="c-text">▬ spent</span>
        </span>
      </div>
      <div className="flex" style={{ flexDirection: 'column', gap: 15 }}>
        {bars.length === 0 && <p className="fs-13 c-sec" style={{ margin: 0 }}>Set budgets in Settings to compare plan and spending.</p>}
        {bars.map(c => <PlanBar key={c.id} c={c} max={maxValue} />)}
      </div>

      {patterns.length > 0 && (
        <>
          <div className="kicker" style={{ margin: '26px 2px 12px' }}>Patterns</div>
          <div className="flex gap-10" style={{ flexDirection: 'column' }}>
            {patterns.map((p, i) => (
              <div className="flex gap-12" key={i} style={{ border: '1px solid var(--color-border)', borderLeft: `3px solid ${p.colour}`, borderRadius: 12, padding: '13px 14px', background: 'var(--color-surface)' }}>
                <span style={{ color: p.colour, marginTop: 1 }}><Icon name={p.icon} size={18} /></span>
                <div className="fs-13" style={{ lineHeight: 1.5 }}>{p.text}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** ₹57.5k style for the donut centre. */
function formatK(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}k`;
  return formatINR(paise);
}

function PlanBar({ c, max }: { c: Category; max: number }) {
  const plan = c.plannedPaise ?? 0;
  const ratio = plan > 0 ? c.spentPaise / plan : 0;
  const isSave = c.bucket === 'save';
  const colour = isSave ? 'var(--color-need)' : plan === 0 ? 'var(--color-text-muted)' : ratio > 1 ? 'var(--color-danger)' : ratio > 0.9 ? 'var(--color-accent)' : 'var(--color-success)';
  return (
    <div className="flex gap-6" style={{ flexDirection: 'column' }}>
      <div className="flex jc-sb ai-base">
        <span className="fs-13 flex ai-c gap-6">
          <Icon name={categoryIcon(c)} size={13} /> {c.name}
        </span>
        <span className="num fs-11 c-sec">
          <span style={{ color: colour }}>{formatINR(c.spentPaise)}</span> / {plan > 0 ? formatINR(plan) : 'no plan'}
        </span>
      </div>
      <div className="rel" style={{ height: 14 }}>
        <div className="abs" style={{ top: 0, left: 0, height: 5, borderRadius: 4, background: 'var(--color-plan-marker)', width: `${(plan / max) * 100}%` }} />
        <div className="abs" style={{ top: 8, left: 0, height: 6, borderRadius: 4, background: colour, width: `${Math.min(100, (c.spentPaise / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function buildPatterns(categories: Category[], buckets: HomeData['buckets']) {
  const out: { icon: string; colour: string; text: string }[] = [];
  const over = categories.filter(c => c.plannedPaise && c.spentPaise > c.plannedPaise).sort((a, b) => b.spentPaise - b.plannedPaise! - (a.spentPaise - a.plannedPaise!));
  for (const c of over.slice(0, 2)) {
    out.push({
      icon: categoryIcon(c),
      colour: 'var(--color-danger)',
      text: `${c.name}: spent ${formatINR(c.spentPaise)} vs ${formatINR(c.plannedPaise!)} planned — ${formatINR(c.spentPaise - c.plannedPaise!)} over.`,
    });
  }
  const needs = buckets.find(b => b.bucket === 'need');
  if (needs?.hasBudget && needs.plannedPaise > 0 && needs.spentPaise / needs.plannedPaise <= 0.9) {
    out.push({ icon: 'circle-check', colour: 'var(--color-success)', text: `Needs are at ${Math.round((needs.spentPaise / needs.plannedPaise) * 100)}% of plan. On track.` });
  }
  return out;
}

/** Money in and out for the month. Money in is credits by kind; money out is spend, savings and transfers outside. */
function MoneyFlow({ moneyIn, moneyOut }: { moneyIn: MoneyIn; moneyOut: MoneyOut }) {
  const net = moneyIn.totalPaise - moneyOut.totalPaise;
  return (
    <Card as="section" aria-labelledby="money-flow" className="mt-16">
      <h2 id="money-flow" className="kicker kicker--spaced m-0">Money in and out</h2>
      <div className="grid-2 gap-16 mt-8">
        <div>
          <div className="fs-12 c-sec">Money in</div>
          <div className="num fs-18 c-success">{formatINR(moneyIn.totalPaise)}</div>
          <dl className="grid gap-4 mt-8 fs-12 c-sec m-0">
            <FlowRow label="Salary" paise={moneyIn.salaryPaise} />
            <FlowRow label="Others" paise={moneyIn.othersPaise} />
            <FlowRow label="Got back" paise={moneyIn.goneBackPaise} />
            <FlowRow label="Borrowed" paise={moneyIn.borrowedPaise} />
          </dl>
        </div>
        <div>
          <div className="fs-12 c-sec">Money out</div>
          <div className="num fs-18 c-text">{formatINR(moneyOut.totalPaise)}</div>
          <dl className="grid gap-4 mt-8 fs-12 c-sec m-0">
            <FlowRow label="Spend" paise={moneyOut.spendPaise} />
            <FlowRow label="Savings" paise={moneyOut.savingsPaise} />
            <FlowRow label="Outside transfers" paise={moneyOut.outsidePaise} />
            <FlowRow label="Lent" paise={moneyOut.lentPaise} />
          </dl>
        </div>
      </div>
      <p className="fs-12 c-mut mt-8 m-0">Income this month: <span className="num c-text">{formatINR(moneyIn.incomePaise)}</span>. Got back and borrowed money are not income.</p>
      <div className="flex jc-sb ai-c mt-12 fs-13">
        <span className="c-sec">Net this month</span>
        <span className={`num ${net >= 0 ? 'c-success' : 'c-danger'}`}>{net >= 0 ? '+' : '−'}{formatINR(Math.abs(net))}</span>
      </div>
    </Card>
  );
}

function FlowRow({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="flex jc-sb">
      <dt>{label}</dt>
      <dd className="num m-0">{formatINR(paise)}</dd>
    </div>
  );
}

/** Number of categories in the credit card bar chart. */
const CARD_TOP = 5;

/**
 * Credit card use this month: the total beside the title, and a bar chart of the categories it went to.
 * The bill still to pay is mentioned only when it differs from the total, that is, after a bill payment.
 */
function CreditCardSection({ card, categories }: { card: NonNullable<HomeData['card']>; categories: Category[] }) {
  const rows = Object.entries(card.byCategoryPaise ?? {})
    .map(([id, paise]) => ({ category: categories.find(c => c.id === id), paise }))
    .filter((r): r is { category: Category; paise: number } => r.category !== undefined)
    .sort((a, b) => b.paise - a.paise)
    .slice(0, CARD_TOP);
  const max = Math.max(1, ...rows.map(r => r.paise));
  return (
    <Card as="section" aria-labelledby="card-trend" className="mt-16">
      <div className="flex ai-base jc-sb">
        <h2 id="card-trend" className="kicker kicker--spaced m-0">Credit card</h2>
        <span className="num fs-18">{formatINR(card.spentPaise)}</span>
      </div>
      <p className="fs-12 c-sec m-0 mt-2">spent on cards this month{card.duePaise !== card.spentPaise ? ` · ${formatINR(card.duePaise)} bill still to pay` : ''}</p>
      {(card.otherPaise ?? 0) > 0 && <p className="fs-12 c-mut m-0 mt-2">Not counted: {formatINR(card.otherPaise ?? 0)} lent or moved out of a card. It is on the bill but it is not spending.</p>}
      {rows.length > 0 && (
        <ul className="list-reset grid gap-10 mt-12" aria-label="Top categories on card">
          {rows.map(r => (
            <li key={r.category.id}>
              <div className="flex jc-sb fs-13">
                <span className="flex ai-c gap-6"><Icon name={categoryIcon(r.category)} size={13} /> {r.category.name}</span>
                <span className="num">{formatINR(r.paise)}</span>
              </div>
              <div className="track mt-4"><div className="fill" style={{ width: `${(r.paise / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Money out of each account this month, as bars. Transfers between your own accounts are not counted. */
function AccountChart({ rows, accounts }: { rows: { accountId: string; paise: number }[]; accounts: Account[] }) {
  const total = rows.reduce((s, r) => s + r.paise, 0);
  const max = Math.max(1, ...rows.map(r => r.paise));
  return (
    <Card as="section" aria-labelledby="account-trend" className="mt-16">
      <div className="flex ai-base jc-sb">
        <h2 id="account-trend" className="kicker kicker--spaced m-0">Spend by account</h2>
        <span className="num fs-18">{formatINR(total)}</span>
      </div>
      <p className="fs-12 c-sec m-0 mt-2">spent from your accounts this month</p>
      <ul className="list-reset grid gap-10 mt-12">
        {rows.map(r => {
          const a = accounts.find(x => x.id === r.accountId);
          return (
            <li key={r.accountId}>
              <div className="flex jc-sb fs-13">
                <span className="flex ai-c gap-6"><Icon name={a?.icon ?? 'wallet'} size={13} /> {a?.nickname ?? 'Account'}</span>
                <span className="num">{formatINR(r.paise)} <span className="c-mut fs-11">{Math.round((r.paise / total) * 100)}%</span></span>
              </div>
              <div className="track mt-4"><div className="fill" style={{ width: `${(r.paise / max) * 100}%` }} /></div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
