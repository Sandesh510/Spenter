import { Icon } from '../components/Icon';
import { formatINR } from '../lib/money';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth, dayOfMonth, daysInMonth, monthTitle } from '../lib/dates';
import { useApi } from '../lib/useApi';
import type { Bucket, HomeBucket, HomeData, AskItem } from '../lib/types';
import type { Route } from '../App';

/** Home, per screens/ScreenHome.dc.html. Bucket colour rules come from the README. */
export function Home({ token, go }: { token: string; go: (r: Route) => void }) {
  const month = currentMonth();
  const { data, error } = useApi<HomeData>(`home?month=${month}`, token);

  if (error) return <div className="scroll" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  if (!data) return <div className="scroll" style={{ color: 'var(--color-text-secondary)' }}>Loading…</div>;

  const spent = data.spendPaise + data.savingsPaise;
  const progress = data.openingPaise > 0 ? Math.min(1, spent / data.openingPaise) : 0;

  return (
    <div className="scroll">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '6px 0 18px' }}>
        <div>
          <div className="kicker kicker--amber" style={{ letterSpacing: '.14em' }}>This month</div>
          <h1 className="heading" style={{ fontSize: 22, lineHeight: 1.1, marginTop: 2 }}>{monthTitle(month)}</h1>
        </div>
        <button className="iconbtn" onClick={() => go('settings')} aria-label="Settings">
          <Icon name="user" size={19} />
        </button>
      </div>

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Balance left to spend</span>
          <span style={{ color: 'var(--color-text-muted)' }}><Icon name="info" size={15} /></span>
        </div>
        <div className="heading num" style={{ fontSize: 44, lineHeight: 1, margin: '8px 0 14px', color: data.spendableBalancePaise < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
          {formatINR(data.spendableBalancePaise)}
        </div>
        <div className="track">
          <div className="fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="num" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <span>Started <span style={{ color: 'var(--color-text-primary)' }}>{formatINR(data.openingPaise)}</span></span>
          <span>Spent <span style={{ color: 'var(--color-text-primary)' }}>{formatINR(spent)}</span></span>
        </div>
      </section>

      <button
        className="card"
        onClick={() => go('lent')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 12, padding: 14, cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Money lent · yet to get back</span>
        <span className="num" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LentTotal token={token} />
          <Icon name="chevron-right" size={16} />
        </span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 2px 14px' }}>
        <span className="kicker">Budgets</span>
        <span className="kicker num">day {dayOfMonth()} / {daysInMonth(month)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {data.buckets.map(b => (
          <BudgetBar key={b.bucket} b={b} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '26px 2px 12px' }}>
        <span className="kicker">Recent asks</span>
        <button className="link" onClick={() => go('log')} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          See all <Icon name="chevron-right" size={14} />
        </button>
      </div>
      {data.asks.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>No decisions yet. Tap the centre button to check a purchase.</p>
      ) : (
        <div>{data.asks.map(a => <AskRow key={a.id} a={a} />)}</div>
      )}
    </div>
  );
}

/** Colour rules from the README: green ≤90% of plan, amber 90–100%, red over. Savings is blue until the goal is met. */
function BudgetBar({ b }: { b: HomeBucket }) {
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
    note = ratio >= 1 ? 'goal met' : `${formatINR(-left)} to go`;
  } else if (over) {
    note = `${formatINR(-left)} over`;
  } else {
    note = `${formatINR(left)} left${ratio > 0.9 ? ' · tight' : ''}`;
  }
  const sub = !b.hasBudget ? 'no plan set' : isSave ? `${Math.round(ratio * 100)}% of goal` : `${Math.round(ratio * 100)}% of plan`;
  const pct = Math.min(1, ratio);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13.5, color: 'var(--color-text-primary)' }}>{BUCKET_LABEL[b.bucket as Bucket]}</span>
        <span className="num" style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>{formatINR(b.spentPaise)}</span> / {b.hasBudget ? formatINR(b.plannedPaise) : '—'}
        </span>
      </div>
      <div className="track track--thin">
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-secondary)' }}>
        <span>{sub}</span>
        {note && <span className="num" style={{ color: noteColor }}>{note}</span>}
      </div>
    </div>
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
      <div style={{ width: 34, height: 34, flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: v.bg, color: v.color }}>
        <Icon name={v.icon} size={17} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.item}</div>
        <div style={{ fontSize: 11.5, color: 'var(--color-text-secondary)', marginTop: 1 }}>{v.label} · {a.categoryName ?? 'No category'}</div>
      </div>
      <div className="num" style={{ fontSize: 14 }}>{formatINR(a.amountPaise)}</div>
    </div>
  );
}

/** Total still owed to you, from the lent endpoint. */
function LentTotal({ token }: { token: string }) {
  const { data } = useApi<{ items: { amount_paise: number; settled_at: string | null }[] }>('lent', token);
  const total = (data?.items ?? []).filter(l => !l.settled_at).reduce((s, l) => s + l.amount_paise, 0);
  return <span>{formatINR(total)}</span>;
}
