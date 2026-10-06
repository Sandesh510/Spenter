import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Keypad, applyKey } from '../components/Keypad';
import { Verdict } from '../components/Verdict';
import { api } from '../lib/api';
import { haptic } from '../lib/haptics';
import { BUCKET_LABEL, BUCKET_TAG } from '../lib/categories';
import { currentMonth } from '../lib/dates';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, Bucket, HomeData } from '../lib/types';
import type { Route } from '../App';

/** "Should I buy this?", per screens/ScreenAsk.dc.html. Bought records a transaction; skipped and delayed record an ask only. */
export function Ask({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);

  const categories = home.data?.categories ?? [];
  const selected = categories.find(c => c.id === categoryId) ?? null;
  const amountPaise = useMemo(() => {
    try {
      return amount ? parseRupeesToPaise(amount) : 0;
    } catch {
      return 0;
    }
  }, [amount]);

  async function decide(decision: 'bought' | 'skipped' | 'delayed') {
    setError(null);
    if (!item.trim()) return setError('Name the item first');
    if (!amountPaise) return setError('Enter the amount');
    if (!selected) return setError('Choose a category');
    const account = accounts.data?.items[0];
    if (decision === 'bought' && !account) return setError('Add an account in Settings first');

    setBusy(true);
    try {
      await api('asks', {
        token,
        body: {
          item: item.trim(),
          amount,
          decision,
          categoryId: selected.id,
          accountId: decision === 'bought' ? account?.id : undefined,
        },
      });
      haptic(decision === 'skipped' ? 'warning' : 'success');
      onToast(decision === 'bought' ? `Bought · ${formatINR(amountPaise)} to ${selected.name}` : decision === 'skipped' ? 'Skipped' : 'Delayed');
      go('home');
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const grouped = (['need', 'want', 'save'] as Bucket[]).map(b => ({ bucket: b, items: categories.filter(c => c.bucket === b) }));

  return (
    <div className="scroll">
      <div className="topbar" style={{ padding: '8px 0 4px' }}>
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">Should I buy this?</span>
        <span style={{ width: 36 }} />
      </div>

      <div className="card" style={{ padding: '12px 14px', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          <span style={{ color: 'var(--faint)' }}><Icon name="pencil-line" size={15} /></span>
          <input
            className="input"
            style={{ fontSize: 14, borderBottom: 'none', padding: 0 }}
            placeholder="What is it?"
            value={item}
            onChange={e => setItem(e.target.value)}
            maxLength={80}
            aria-label="Item"
          />
        </div>
        <div className="num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '10px 0 2px' }}>
          <span className="heading" style={{ fontSize: 26, color: 'var(--muted)' }}>₹</span>
          <span className="heading" style={{ fontSize: 46, lineHeight: 1 }}>{amount ? Number(amount).toLocaleString('en-IN') : '0'}</span>
          <span className="caret" />
        </div>
      </div>

      <div className="kicker" style={{ margin: '16px 0 6px' }}>Category</div>
      <div className="chiprow">
        {grouped.flatMap(g => g.items).map(c => (
          <button key={c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <Keypad onKey={k => setAmount(a => applyKey(a, k))} />
      </div>

      {selected && amountPaise > 0 && home.data && (
        <div style={{ marginTop: 16 }}>
          <Verdict
            amountPaise={amountPaise}
            category={{ name: selected.name, bucket: selected.bucket, plannedPaise: selected.plannedPaise, spentPaise: selected.spentPaise }}
            spendableBalancePaise={home.data.spendableBalancePaise}
          />
          <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>{BUCKET_LABEL[selected.bucket]} · {BUCKET_TAG[selected.bucket]}</div>
        </div>
      )}

      {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 9, marginTop: 16 }}>
        <DecisionButton label="Bought" colour="var(--green)" disabled={busy} onClick={() => decide('bought')} />
        <DecisionButton label="Skipped" colour="var(--red)" disabled={busy} onClick={() => decide('skipped')} />
        <DecisionButton label="Delayed" colour="var(--amber)" disabled={busy} onClick={() => decide('delayed')} />
      </div>
    </div>
  );
}

function DecisionButton({ label, colour, disabled, onClick }: { label: string; colour: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{ flex: 1, height: 56, borderRadius: 14, background: 'transparent', border: `1.5px solid ${colour}`, color: colour, fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
    >
      {label}
    </button>
  );
}
