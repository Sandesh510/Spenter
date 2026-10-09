import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { BUCKET_LABEL, BUCKET_TINT, categoryIcon } from '../lib/categories';
import { currentMonth, dayLabel, monthTitle, shiftMonth } from '../lib/dates';
import { formatINR } from '../lib/money';
import { matchesSearch } from '../lib/logSearch';
import { useApi } from '../lib/useApi';
import { releaseSavedLogFilter, saveLogFilter, takeSavedLogFilter } from '../lib/logFilter';
import type { Account, Bucket, Category, HomeData, TxnRow } from '../lib/types';
import type { Route } from '../App';

/** Transactions, per screens/ScreenLog.dc.html. Filter chips narrow the list client-side. */
export function Log({ token, go, onEdit, initialCategoryId, initialBucket, initialMonth }: {
  token: string;
  go: (r: Route) => void;
  onEdit: (t: TxnRow) => void;
  /** Set when opened from Home (a category or a budget bar): the Log starts filtered to it. */
  initialCategoryId?: string;
  initialBucket?: Bucket;
  initialMonth?: string;
}) {
  // After a reload the filters come back; a filter chosen from Home wins over them.
  const [saved] = useState(() => (initialCategoryId || initialBucket || initialMonth ? null : takeSavedLogFilter()));
  const [month, setMonth] = useState(initialMonth ?? saved?.month ?? currentMonth());
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? saved?.categoryId ?? '');
  const [bucket, setBucket] = useState<Bucket | ''>((initialBucket ?? saved?.bucket ?? '') as Bucket | '');
  const [accountId, setAccountId] = useState(saved?.accountId ?? '');
  useEffect(() => {
    releaseSavedLogFilter();
    saveLogFilter({ month, categoryId, bucket, accountId });
  }, [month, categoryId, bucket, accountId]);
  const [selected, setSelected] = useState<TxnRow | null>(null);
  const [query, setQuery] = useState('');
  /** The entry just deleted, kept for a few seconds so the delete can be undone. */
  const [undo, setUndo] = useState<{ txn: TxnRow; title: string } | null>(null);
  const undoTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(undoTimer.current), []);
  const [error, setError] = useState<string | null>(null);

  const txns = useApi<{ items: TxnRow[] }>(`transactions?month=${month}`, token);
  const home = useApi<HomeData>(`home?month=${month}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);

  const categories = home.data?.categories ?? [];
  const accountName = (id: string | null) => accounts.data?.items.find(a => a.id === id)?.nickname ?? '';
  const categoryOf = (id: string | null) => categories.find(c => c.id === id) ?? null;
  const titleOf = (t: TxnRow) => t.description ?? (t.type === 'transfer' ? 'Transfer' : categoryOf(t.category_id)?.name ?? (t.type === 'credit' ? 'Money in' : 'Spend'));

  const rows = useMemo(() => {
    return (txns.data?.items ?? []).filter(t => {
      if (categoryId && t.category_id !== categoryId) return false;
      // A budget filter shows spends in that bucket's categories; credits and transfers have no bucket.
      if (bucket && categoryOf(t.category_id)?.bucket !== bucket) return false;
      if (accountId && t.account_id !== accountId && t.to_account_id !== accountId) return false;
      if (query.trim() && !matchesSearch(query, { title: titleOf(t), category: categoryOf(t.category_id)?.name ?? '', account: accountName(t.account_id), description: t.description ?? t.reference, amountPaise: t.amount_paise })) return false;
      return true;
    });
  }, [txns.data, categoryId, accountId, bucket, categories, query, accounts.data]);

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
    // Automatic entries (EMI, SIP, subscription, premium) change a loan or a schedule when deleted and
    // cannot be brought back, so those still ask first. Everything else is deleted at once with an Undo.
    const automatic = Boolean(t.commitment_id || t.policy_id);
    if (automatic && !window.confirm('This entry was posted automatically. Delete it? It will be hidden from totals.')) return;
    try {
      await api(`transactions?id=${t.id}`, { method: 'DELETE', token });
      haptic('warning');
      txns.reload();
      home.reload();
      if (!automatic) {
        window.clearTimeout(undoTimer.current);
        setUndo({ txn: t, title: titleOf(t) });
        undoTimer.current = window.setTimeout(() => setUndo(null), 7000);
      }
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not delete');
    }
  }

  async function undoDelete() {
    if (!undo) return;
    const { txn } = undo;
    window.clearTimeout(undoTimer.current);
    setUndo(null);
    try {
      await api('transactions', { token, body: { action: 'restore', id: txn.id } });
      haptic('success');
      txns.reload();
      home.reload();
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not bring it back');
    }
  }

  const recent = recentMonths(6);
  // A month opened from Home can be older than the last six; keep it selectable.
  const monthOptions = recent.some(m => m.value === month) ? recent : [...recent, { value: month, label: monthTitle(month) }];

  return (
    <div className="scroll" style={{ paddingBottom: 92 }}>
      <div className="flex ai-c jc-sb" style={{ margin: '8px 0 0' }}>
        <h1 className="heading fs-24">Transactions</h1>
        <button className="iconbtn" onClick={() => go('quickadd')} aria-label="Add transaction">
          <Icon name="plus" size={17} />
        </button>
      </div>

      <div className="mt-12">
        <Input type="search" aria-label="Search transactions" placeholder="Search notes, categories, amounts" value={query} onChange={e => setQuery(e.target.value)} />
      </div>

      <div className="chiprow" style={{ margin: '14px -18px 0', padding: '0 18px 2px' }}>
        <button className={`chip ${!categoryId && !accountId && !bucket ? 'chip--on' : ''}`} onClick={() => { setCategoryId(''); setAccountId(''); setBucket(''); }}>All</button>
        <FilterSelect
          label="Budget"
          value={bucket}
          onChange={v => {
            const next = v as Bucket | '';
            setBucket(next);
            // Keep a chosen category only if it belongs to the new budget.
            if (next && categoryOf(categoryId)?.bucket !== next) setCategoryId('');
          }}
          options={(['need', 'want', 'save'] as Bucket[]).map(b => ({ value: b, label: BUCKET_LABEL[b] }))}
        />
        <FilterSelect label="Category" value={categoryId} onChange={setCategoryId} options={categories.filter((c: Category) => !bucket || c.bucket === bucket).map((c: Category) => ({ value: c.id, label: c.name }))} />
        <FilterSelect label="Account" value={accountId} onChange={setAccountId} options={(accounts.data?.items ?? []).map(a => ({ value: a.id, label: a.nickname }))} />
        <FilterSelect label={monthLabelShort(month)} value={month} onChange={setMonth} options={monthOptions.map(m => ({ value: m.value, label: m.label }))} allowAll={false} />
      </div>

      {(txns.error || error) && <p className="c-danger fs-13" role="alert">{txns.error ?? error}</p>}

      {groups.length === 0 && !txns.error && (
        <p className="fs-13 c-sec mt-24">{query.trim() ? `Nothing matches “${query.trim()}” here.` : 'No transactions for this filter.'}</p>
      )}

      {groups.map(g => (
        <section key={g.date}>
          <div className="flex ai-base jc-sb" style={{ margin: '16px 2px 6px' }}>
            <span className="kicker">{dayLabel(g.date)}</span>
            <span className="num fs-12 c-mut">{formatINR(g.total)}</span>
          </div>
          {g.items.map(t => {
            const cat = categoryOf(t.category_id);
            const bucket: Bucket | null = cat?.bucket ?? null;
            const tint = t.type === 'spend' && bucket ? BUCKET_TINT[bucket] : { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' };
            const isIn = t.type === 'credit';
            const icon = t.type === 'transfer' ? 'arrow-left-right' : isIn ? 'arrow-down-left' : cat ? categoryIcon(cat) : 'circle';
            const title = titleOf(t);
            const meta = t.type === 'transfer'
              ? `${accountName(t.account_id)}${t.external ? ' → outside' : ` → ${accountName(t.to_account_id)}`}`
              : accountName(t.account_id);
            return (
              <button key={t.id} className="row" onClick={() => setSelected(t)} style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border)', color: 'inherit', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }} aria-label={`Edit or delete ${title}`}>
                <div className="flex-none grid" style={{ width: 38, height: 38, borderRadius: 11, placeItems: 'center', background: tint.bg, color: tint.fg }}>
                  <Icon name={icon} size={17} />
                </div>
                <div className="flex-1 min-0">
                  <div className="fs-14 nowrap ovh ellipsis">{title}</div>
                  <div className="flex ai-c gap-6" style={{ marginTop: 3 }}>
                    {cat && t.type !== 'transfer' && (
                      <span className="fs-11" style={{ padding: '2px 7px', borderRadius: 5, background: tint.bg, color: tint.fg }}>{cat.name}</span>
                    )}
                    <span className="fs-11 c-mut">{meta}</span>
                  </div>
                </div>
                <div className="num fs-15" style={{ color: isIn ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                  {isIn ? '+' : ''}{formatINR(t.amount_paise)}
                </div>
              </button>
            );
          })}
        </section>
      ))}

      {undo && (
        <div className="undo-bar" role="status">
          <span className="undo-bar__text">Deleted {undo.title} · {formatINR(undo.txn.amount_paise)}</span>
          <button className="link" onClick={undoDelete}>Undo</button>
        </div>
      )}

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Transaction actions"
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 20 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'var(--color-surface)', borderRadius: '18px 18px 0 0', padding: '14px 16px 22px', display: 'grid', gap: 9 }}
          >
            <div className="fs-13 c-sec ta-c ovh ellipsis nowrap" style={{ marginBottom: 4 }}>
              {titleOf(selected)} · {formatINR(selected.amount_paise)}
            </div>
            <Button block onClick={() => { const t = selected; setSelected(null); onEdit(t); }}>
              <Icon name="pencil-line" size={16} /> Edit
            </Button>
            <button
              onClick={() => { const t = selected; setSelected(null); remove(t); }}
              style={{ height: 48, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'transparent', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}
            >
              <Icon name="trash-2" size={16} /> Delete
            </button>
            <button className="link" onClick={() => setSelected(null)} style={{ padding: 10, color: 'var(--color-text-secondary)' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

const ALL_LABEL: Record<string, string> = { Category: 'All categories', Account: 'All accounts', Budget: 'All budgets' };

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
  // An active filter shows what it is set to, e.g. "Food Wants" instead of "Category".
  const shown = active ? options.find(o => o.value === value)?.label ?? label : label;
  return (
    <label className={`chip ${active ? 'chip--on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, position: 'relative' }}>
      {shown} <Icon name="chevron-down" size={13} />
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
  // The current month in India, not UTC: just after midnight on the 1st UTC is still last month.
  const thisMonth = currentMonth();
  for (let i = 0; i < n; i++) {
    const value = shiftMonth(thisMonth, -i);
    out.push({ value, label: monthTitle(value) });
  }
  return out;
}

function monthLabelShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' });
}
