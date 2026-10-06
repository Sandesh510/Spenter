import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { BUCKET_TINT, iconFor } from '../lib/categories';
import { currentMonth, dayLabel } from '../lib/dates';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, Bucket, Category, HomeData, TxnRow } from '../lib/types';
import type { Route } from '../App';

/** Transactions, per screens/ScreenLog.dc.html. Filter chips narrow the list client-side. */
export function Log({ token, go }: { token: string; go: (r: Route) => void }) {
  const [month, setMonth] = useState(currentMonth());
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const txns = useApi<{ items: TxnRow[] }>(`transactions?month=${month}`, token);
  const home = useApi<HomeData>(`home?month=${month}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);

  const categories = home.data?.categories ?? [];
  const accountName = (id: string | null) => accounts.data?.items.find(a => a.id === id)?.nickname ?? '';
  const categoryOf = (id: string | null) => categories.find(c => c.id === id) ?? null;

  const rows = useMemo(() => {
    return (txns.data?.items ?? []).filter(t => {
      if (categoryId && t.category_id !== categoryId) return false;
      if (accountId && t.account_id !== accountId && t.to_account_id !== accountId) return false;
      return true;
    });
  }, [txns.data, categoryId, accountId]);

  const groups = useMemo(() => {
    const byDate = new Map<string, TxnRow[]>();
    for (const t of rows) byDate.set(t.txn_date, [...(byDate.get(t.txn_date) ?? []), t]);
    return [...byDate.entries()].map(([date, items]) => ({
      date,
      total: items.filter(i => i.type === 'spend').reduce((s, i) => s + i.amount_paise, 0),
      items,
    }));
  }, [rows]);

  async function remove(t: TxnRow) {
    if (!window.confirm('Delete this transaction? It will be hidden from totals.')) return;
    try {
      await api(`transactions?id=${t.id}`, { method: 'DELETE', token });
      haptic('warning');
      txns.reload();
      home.reload();
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  const monthOptions = recentMonths(6);

  return (
    <div className="scroll" style={{ paddingBottom: 92 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 0' }}>
        <h1 className="heading" style={{ fontSize: 24 }}>Transactions</h1>
        <button className="iconbtn" onClick={() => go('quickadd')} aria-label="Add transaction">
          <Icon name="plus" size={17} />
        </button>
      </div>

      <div className="chiprow" style={{ margin: '14px -18px 0', padding: '0 18px 2px' }}>
        <button className={`chip ${!categoryId && !accountId ? 'chip--on' : ''}`} onClick={() => { setCategoryId(''); setAccountId(''); }}>All</button>
        <FilterSelect label="Category" value={categoryId} onChange={setCategoryId} options={categories.map((c: Category) => ({ value: c.id, label: c.name }))} />
        <FilterSelect label="Account" value={accountId} onChange={setAccountId} options={(accounts.data?.items ?? []).map(a => ({ value: a.id, label: a.nickname }))} />
        <FilterSelect label={monthLabelShort(month)} value={month} onChange={setMonth} options={monthOptions.map(m => ({ value: m.value, label: m.label }))} allowAll={false} />
      </div>

      {(txns.error || error) && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>{txns.error ?? error}</p>}

      {groups.length === 0 && !txns.error && (
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 24 }}>No transactions for this filter.</p>
      )}

      {groups.map(g => (
        <section key={g.date}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '16px 2px 6px' }}>
            <span className="kicker">{dayLabel(g.date)}</span>
            <span className="num" style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{formatINR(g.total)}</span>
          </div>
          {g.items.map(t => {
            const cat = categoryOf(t.category_id);
            const bucket: Bucket | null = cat?.bucket ?? null;
            const tint = t.type === 'spend' && bucket ? BUCKET_TINT[bucket] : { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' };
            const isIn = t.type === 'credit';
            const icon = t.type === 'transfer' ? 'arrow-left-right' : isIn ? 'arrow-down-left' : iconFor(cat?.name);
            const title = t.description ?? (t.type === 'transfer' ? 'Transfer' : cat?.name ?? (isIn ? 'Money in' : 'Spend'));
            const meta = t.type === 'transfer'
              ? `${accountName(t.account_id)}${t.external ? ' → outside' : ` → ${accountName(t.to_account_id)}`}`
              : accountName(t.account_id);
            return (
              <button key={t.id} className="row" onClick={() => remove(t)} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }} aria-label={`Delete ${title}`}>
                <div style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, display: 'grid', placeItems: 'center', background: tint.bg, color: tint.fg }}>
                  <Icon name={icon} size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    {cat && t.type !== 'transfer' && (
                      <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 5, background: tint.bg, color: tint.fg }}>{cat.name}</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{meta}</span>
                  </div>
                </div>
                <div className="num" style={{ fontSize: 14.5, color: isIn ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                  {isIn ? '+' : ''}{formatINR(t.amount_paise)}
                </div>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

const ALL_LABEL: Record<string, string> = { Category: 'All categories', Account: 'All accounts' };

/** A chip that opens a native select, styled as the mockup's outlined filter chip. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
  allowAll = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowAll?: boolean;
}) {
  const active = value !== '' && allowAll;
  return (
    <label className={`chip ${active ? 'chip--on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, position: 'relative' }}>
      {label} <Icon name="chevron-down" size={13} />
      <select
        aria-label={label}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
      >
        {allowAll && <option value="">{ALL_LABEL[label] ?? `All ${label.toLowerCase()}`}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function recentMonths(n: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = d.toISOString().slice(0, 7);
    out.push({ value, label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) });
  }
  return out;
}

function monthLabelShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
}
