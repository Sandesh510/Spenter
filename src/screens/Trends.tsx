import { Icon } from '../components/Icon';
import { iconFor } from '../lib/categories';
import { currentMonth, monthTitle } from '../lib/dates';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Bucket, Category, HomeData } from '../lib/types';

const TARGET: Record<Bucket, number> = { need: 50, want: 30, save: 20 };
const LABEL: Record<Bucket, string> = { need: 'Needs', want: 'Wants', save: 'Savings' };
const COLOUR: Record<Bucket, string> = { need: 'var(--color-need)', want: 'var(--color-accent)', save: 'var(--color-success)' };

/** Monthly summary, per screens/ScreenSummary.dc.html. Every figure is computed from the month's data. */
export function Trends({ token }: { token: string }) {
  const month = currentMonth();
  const { data, error } = useApi<HomeData>(`home?month=${month}`, token);

  if (error) return <div className="scroll" role="alert" style={{ color: 'var(--color-danger)' }}>{error}</div>;
  if (!data) return <div className="scroll" style={{ color: 'var(--color-text-secondary)' }}>Loading…</div>;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 8px' }}>
        <h1 className="heading" style={{ fontSize: 24 }}>{monthTitle(month).split(' ')[0]}</h1>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>This month</span>
      </div>

      <section className="card" style={{ display: 'flex', alignItems: 'center', gap: 18, padding: 18 }}>
        <div style={{ position: 'relative', width: 120, height: 120, flex: 'none' }}>
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
          <div style={{ position: 'absolute', inset: 19, borderRadius: '50%', background: 'var(--color-surface)', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
            <div>
              <div className="heading num" style={{ fontSize: 18, lineHeight: 1 }}>{formatK(total)}</div>
              <div style={{ fontSize: 9.5, color: 'var(--color-text-secondary)', marginTop: 1 }}>spent</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
          {(['need', 'want', 'save'] as Bucket[]).map(b => (
            <div key={b} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOUR[b] }} />
              <span style={{ fontSize: 13, flex: 1 }}>{LABEL[b]}</span>
              <span className="num" style={{ fontSize: 13 }}>{pct[b]}%</span>
              <span className="num" style={{ fontSize: 10.5, color: Math.abs(pct[b] - TARGET[b]) <= 5 ? 'var(--color-success)' : 'var(--color-text-muted)', width: 34, textAlign: 'right' }}>/ {TARGET[b]}</span>
            </div>
          ))}
        </div>
      </section>
      <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--color-text-secondary)', margin: '9px 0 0' }}>{caption}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 2px 14px' }}>
        <span className="kicker">Planned vs actual</span>
        <span style={{ display: 'flex', gap: 10, fontSize: 11 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>▬ plan</span>
          <span style={{ color: 'var(--color-text-primary)' }}>▬ spent</span>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {bars.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>Set budgets in Settings to compare plan and spending.</p>}
        {bars.map(c => <PlanBar key={c.id} c={c} max={maxValue} />)}
      </div>

      {patterns.length > 0 && (
        <>
          <div className="kicker" style={{ margin: '26px 2px 12px' }}>Patterns</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {patterns.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, border: '1px solid var(--color-border)', borderLeft: `3px solid ${p.colour}`, borderRadius: 12, padding: '13px 14px', background: 'var(--color-surface)' }}>
                <span style={{ color: p.colour, marginTop: 1 }}><Icon name={p.icon} size={18} /></span>
                <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{p.text}</div>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={iconFor(c.name)} size={13} /> {c.name}
        </span>
        <span className="num" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span style={{ color: colour }}>{formatINR(c.spentPaise)}</span> / {plan > 0 ? formatINR(plan) : 'no plan'}
        </span>
      </div>
      <div style={{ position: 'relative', height: 14 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: 5, borderRadius: 4, background: 'var(--color-plan-marker)', width: `${(plan / max) * 100}%` }} />
        <div style={{ position: 'absolute', top: 8, left: 0, height: 6, borderRadius: 4, background: colour, width: `${Math.min(100, (c.spentPaise / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function buildPatterns(categories: Category[], buckets: HomeData['buckets']) {
  const out: { icon: string; colour: string; text: string }[] = [];
  const over = categories.filter(c => c.plannedPaise && c.spentPaise > c.plannedPaise).sort((a, b) => b.spentPaise - b.plannedPaise! - (a.spentPaise - a.plannedPaise!));
  for (const c of over.slice(0, 2)) {
    out.push({
      icon: iconFor(c.name),
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
