import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth, monthTitle, todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, CommitmentItem, CommitmentsData, HomeData } from '../lib/types';
import type { Route } from '../App';

type Tab = 'subscription' | 'investment' | 'loan';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'subscription', label: 'Subscriptions', icon: 'repeat' },
  { id: 'investment', label: 'Investments', icon: 'trending-up' },
  { id: 'loan', label: 'Loans', icon: 'landmark' },
];

/**
 * Subscriptions, SIP investments and loan EMIs. Each posts automatically on its day once a month.
 * A new loan's money comes in as a credit under Others; an existing loan only tracks repayments.
 */
export function Commitments({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const [tab, setTab] = useState<Tab>('subscription');
  const [adding, setAdding] = useState(false);
  const { data, error, reload } = useApi<CommitmentsData>('commitments', token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);

  const items = (data?.items ?? []).filter(i => i.kind === tab);

  async function act(body: Record<string, unknown>, method: 'PATCH' | 'DELETE', done: string) {
    try {
      if (method === 'DELETE') await api(`commitments?id=${encodeURIComponent(String(body.id))}`, { method, token });
      else await api('commitments', { method, token, body });
      haptic('success');
      reload();
      onToast(done);
    } catch (err) {
      haptic('error');
      onToast(err instanceof Error ? err.message : 'Could not update');
    }
  }

  return (
    <div className="scroll">
      <div className="topbar" style={{ padding: '8px 0 4px' }}>
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back"><Icon name="chevron-left" size={18} /></button>
        <span className="topbar__title">Commitments</span>
        <span style={{ width: 36 }} />
      </div>

      {error && <p className="c-danger fs-13" role="alert">{error}</p>}

      <Card as="section" className="mt-8">
        <div className="fs-13 c-sec">Every month · {monthTitle(currentMonth())}</div>
        <div className="grid gap-8 mt-8">
          <Total label="Subscriptions" paise={data?.totals.subscriptionsPaise ?? 0} />
          <Total label="Investments (SIP)" paise={data?.totals.investmentsPaise ?? 0} />
          <Total label="Loan EMIs" paise={data?.totals.emisPaise ?? 0} />
        </div>
      </Card>

      <div className="chiprow mt-16">
        {TABS.map(t => (
          <button key={t.id} className={`chip ${tab === t.id ? 'chip--on' : ''}`} onClick={() => { setTab(t.id); setAdding(false); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="kicker mt-16" style={{ marginBottom: 8 }}>{TABS.find(t => t.id === tab)?.label}</div>

      {items.length === 0 && !adding && <p className="fs-13 c-sec">Nothing added yet.</p>}

      <div className="grid gap-10">
        {items.map(i => (
          <ItemRow key={i.id} item={i} onPause={() => act({ id: i.id, active: !i.active }, 'PATCH', i.active ? `${i.name} paused` : `${i.name} resumed`)} onRemove={() => { if (window.confirm(`Remove ${i.name}? Past postings stay in the Log.`)) act({ id: i.id }, 'DELETE', `${i.name} removed`); }} />
        ))}
      </div>

      {adding ? (
        <AddForm
          token={token}
          kind={tab}
          accounts={accounts.data?.items ?? []}
          categories={home.data?.categories ?? []}
          onCancel={() => setAdding(false)}
          onSaved={(name) => { setAdding(false); reload(); onToast(`${name} added`); }}
        />
      ) : (
        <Button variant="secondary" block className="mt-16" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> {tab === 'subscription' ? 'Add subscription' : tab === 'investment' ? 'Add SIP' : 'Add loan'}
        </Button>
      )}

      {tab === 'investment' && (
        <p className="fs-12 c-mut mt-12">
          Lump-sum investments are not repeated here. Add them as a Spend under the Investment category.
        </p>
      )}
    </div>
  );
}

function Total({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="flex jc-sb ai-c">
      <span className="fs-14 c-sec">{label}</span>
      <span className="num fs-15">{formatINR(paise)}</span>
    </div>
  );
}

function ItemRow({ item: i, onPause, onRemove }: { item: CommitmentItem; onPause: () => void; onRemove: () => void }) {
  const status = !i.active ? 'Paused' : i.postedThisMonth ? 'Posted this month' : `Next ${shortDate(i.nextDueDate)}`;
  return (
    <Card variant="compact">
      <div className="flex ai-c gap-10">
        <div className="flex-1 min-0">
          <div className="fs-14 nowrap ovh ellipsis">{i.name}</div>
          <div className="fs-12 c-sec mt-2">
            {i.kind === 'investment' ? 'Investment' : i.categoryName}
            {i.bucket && ` · ${BUCKET_LABEL[i.bucket]}`} · day {i.dayOfMonth}
          </div>
          <div className="fs-12 mt-2" style={{ color: i.postedThisMonth && i.active ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>{status}</div>
        </div>
        <div className="num fs-15">{formatINR(i.amountPaise)}</div>
      </div>

      {i.loan && (
        <div className="grid gap-4 mt-8 fs-12 c-sec">
          <span>Outstanding <span className="c-text">{formatINR(i.loan.outstandingPaise)}</span> · {(i.loan.rateBps / 100).toFixed(2)}% a year</span>
          <span>{i.loan.tenureRemaining} months left · next EMI {shortDate(i.loan.nextEmiDate)}</span>
          <span>Next EMI: {formatINR(i.amountPaise)} (interest {formatINR(i.loan.nextInterestPaise)}, principal {formatINR(i.loan.nextPrincipalPaise)})</span>
          <span>Remaining after next EMI <span className="c-text">{formatINR(i.loan.remainingAfterNextPaise)}</span></span>
        </div>
      )}

      <div className="flex gap-14 mt-8">
        <button className="link" onClick={onPause}>{i.active ? 'Pause' : 'Resume'}</button>
        <button className="link c-danger" onClick={onRemove}>Remove</button>
      </div>
    </Card>
  );
}

/** Form for one kind. Subscriptions ask for a category (which sets the bucket); loans ask for the loan type. */
function AddForm({ token, kind, accounts, categories, onCancel, onSaved }: {
  token: string;
  kind: Tab;
  accounts: Account[];
  categories: { id: string; name: string; bucket: string }[];
  onCancel: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [loanIsNew, setLoanIsNew] = useState(false);
  const [outstanding, setOutstanding] = useState('');
  const [rate, setRate] = useState('');
  const [tenure, setTenure] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emiCategory = categories.find(c => c.name === 'EMI')?.id ?? null;
  const pickedCategory = kind === 'loan' ? (categoryId ?? emiCategory) : categoryId;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accountId) return setError('Add an account in Settings first');
    if (kind !== 'investment' && !pickedCategory) return setError(kind === 'loan' ? 'Choose the EMI category' : 'Choose a category');
    setBusy(true);
    try {
      await api('commitments', {
        token,
        body: {
          kind,
          name: name.trim(),
          amount,
          day,
          startsOn: todayIST(),
          accountId,
          categoryId: kind === 'investment' ? undefined : pickedCategory,
          ...(kind === 'loan' ? { loanIsNew, outstanding, rate, tenure } : {}),
        },
      });
      haptic('success');
      onSaved(name.trim());
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card as="section" className="mt-16">
      <form className="grid gap-10" onSubmit={submit}>
        <div className="kicker">{kind === 'subscription' ? 'New subscription' : kind === 'investment' ? 'New SIP' : 'New loan'}</div>

        <Input placeholder={kind === 'loan' ? 'Loan name, e.g. Home loan' : kind === 'investment' ? 'Fund name, e.g. Index fund' : 'Name, e.g. Netflix'} value={name} onChange={e => setName(e.target.value)} required maxLength={60} />

        {kind === 'loan' && (
          <>
            <div className="chiprow">
              <button type="button" className={`chip ${loanIsNew ? 'chip--on' : ''}`} onClick={() => setLoanIsNew(true)}>New loan (money received)</button>
              <button type="button" className={`chip ${!loanIsNew ? 'chip--on' : ''}`} onClick={() => setLoanIsNew(false)}>Existing loan (track only)</button>
            </div>
            <Input numeric inputMode="decimal" placeholder={loanIsNew ? 'Loan amount received' : 'Outstanding amount now'} value={outstanding} onChange={e => setOutstanding(e.target.value)} required />
            <Input numeric inputMode="decimal" placeholder="Interest rate % a year, e.g. 10.5" value={rate} onChange={e => setRate(e.target.value)} required />
            <Input numeric inputMode="numeric" placeholder="Remaining tenure, months" value={tenure} onChange={e => setTenure(e.target.value)} required />
          </>
        )}

        <Input numeric inputMode="decimal" placeholder={kind === 'loan' ? 'EMI amount' : kind === 'investment' ? 'Monthly SIP amount' : 'Monthly amount'} value={amount} onChange={e => setAmount(e.target.value)} required />
        <Input numeric inputMode="numeric" placeholder="Day of month (1–28)" value={day} onChange={e => setDay(e.target.value)} required />

        {kind !== 'investment' && (
          <>
            <div className="kicker">{kind === 'loan' ? 'EMI category' : 'Category (sets the bucket)'}</div>
            <div className="chiprow">
              {categories.map(c => (
                <button type="button" key={c.id} className={`chip ${pickedCategory === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="kicker">Paid from</div>
        <div className="chiprow">
          {accounts.map(a => (
            <button type="button" key={a.id} className={`chip ${accountId === a.id ? 'chip--on' : ''}`} onClick={() => setAccountId(a.id)}>{a.nickname}</button>
          ))}
        </div>

        {error && <p className="c-danger fs-13" role="alert">{error}</p>}

        <div className="flex gap-8">
          <Button type="button" variant="secondary" block onClick={onCancel}>Cancel</Button>
          <Button type="submit" block disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Card>
  );
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
