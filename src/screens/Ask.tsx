import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { Keypad, applyKey } from '../components/Keypad';
import { Verdict } from '../components/Verdict';
import { api } from '../lib/api';
import { pickAccount } from '../lib/defaultAccount';
import { useDefaultAccountId } from '../lib/useDefaultAccount';
import { haptic } from '../lib/haptics';
import { BUCKET_LABEL, BUCKET_TAG } from '../lib/categories';
import { currentMonth } from '../lib/dates';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { useApi } from '../lib/useApi';
import { AskCards } from './AskCards';
import type { Account, Bucket, HomeData } from '../lib/types';
import type { Route } from '../App';

/** "Should I buy this?", per screens/ScreenAsk.dc.html. Bought records a transaction; skipped and delayed record an ask only. */
export function Ask({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  /** The card chosen from the suggestions; "Bought" is recorded on it. */
  const [cardId, setCardId] = useState<string | null>(null);
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

  const defaultAccountId = useDefaultAccountId(token);

  async function decide(decision: 'bought' | 'skipped' | 'delayed') {
    setError(null);
    if (!item.trim()) return setError('Name the item first');
    if (!amountPaise) return setError('Enter the amount');
    if (!selected) return setError('Choose a category');
    const accountList = accounts.data?.items ?? [];
    const account = accountList.find(a => a.id === (cardId ?? pickAccount(accountList, defaultAccountId)));
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
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">Should I buy this?</span>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      <Card className="mt-8" variant="compact">
        <div className="flex ai-c gap-8" style={{ paddingBottom: 8, borderBottom: '1px solid var(--color-border)' }}>
          <span className="c-mut"><Icon name="pencil-line" size={15} /></span>
          <Input className="fs-14"
            
            style={{ borderBottom: 'none', padding: 0 }}
            placeholder="What is it?"
            value={item}
            onChange={e => setItem(e.target.value)}
            maxLength={80}
            aria-label="Item"
          />
        </div>
        <div className="num flex ai-c jc-c gap-2" style={{ padding: '10px 0 2px' }}>
          <span className="heading fs-26 c-sec">₹</span>
          <span className="heading fs-44" style={{ lineHeight: 1 }}>{amount ? Number(amount).toLocaleString('en-IN') : '0'}</span>
          <span className="caret" />
        </div>
      </Card>

      <div className="kicker" style={{ margin: '16px 0 6px' }}>Category</div>
      <div className="chiprow">
        {grouped.flatMap(g => g.items).map(c => (
          <button key={c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-12">
        <Keypad onKey={k => setAmount(a => applyKey(a, k))} />
      </div>

      {selected && amountPaise > 0 && home.data && (
        <div className="mt-16">
          <Verdict
            amountPaise={amountPaise}
            category={{ name: selected.name, bucket: selected.bucket, plannedPaise: selected.plannedPaise, spentPaise: selected.spentPaise }}
            spendableBalancePaise={home.data.safeToSpendPaise ?? home.data.spendableBalancePaise}
          />
          <div className="fs-11 c-mut mt-6">{BUCKET_LABEL[selected.bucket]} · {BUCKET_TAG[selected.bucket]}</div>
        </div>
      )}

      {selected && amountPaise > 0 && (
        <AskCards
          token={token}
          amountPaise={amountPaise}
          categoryId={selected.id}
          item={item}
          selectedId={cardId}
          onSelect={setCardId}
          onOpenOffers={() => go('offers')}
        />
      )}

      {error && <p className="c-danger fs-13 mt-12" role="alert">{error}</p>}

      <div className="flex mt-16" style={{ gap: 9 }}>
        <DecisionButton label="Bought" colour="var(--color-success)" disabled={busy} onClick={() => decide('bought')} />
        <DecisionButton label="Skipped" colour="var(--color-danger)" disabled={busy} onClick={() => decide('skipped')} />
        <DecisionButton label="Delayed" colour="var(--color-accent)" disabled={busy} onClick={() => decide('delayed')} />
      </div>
    </div>
  );
}

function DecisionButton({ label, colour, disabled, onClick }: { label: string; colour: string; disabled: boolean; onClick: () => void }) {
  return (
    <button className="flex-1 ff-heading fw-600 fs-14 pointer"
      disabled={disabled}
      onClick={onClick}
      style={{ height: 56, borderRadius: 14, background: 'transparent', border: `1.5px solid ${colour}`, color: colour }}
    >
      {label}
    </button>
  );
}
