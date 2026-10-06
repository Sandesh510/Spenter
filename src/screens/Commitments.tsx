import { useState, type FormEvent } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { BUCKET_LABEL } from '../lib/categories';
import { currentMonth, monthTitle, todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, CommitmentItem, CommitmentsData, HomeData, InsurancePolicy } from '../lib/types';
import { InsuranceSection } from './Insurance';
import type { Route } from '../App';

type Tab = 'subscription' | 'investment' | 'loan' | 'insurance';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'subscription', label: 'Subscriptions', icon: 'repeat' },
  { id: 'investment', label: 'Investments', icon: 'trending-up' },
  { id: 'loan', label: 'Loans', icon: 'landmark' },
  { id: 'insurance', label: 'Insurance', icon: 'shield' },
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
  const insurance = useApi<{ items: InsurancePolicy[] }>('insurance', token);

  const items = (data?.items ?? []).filter(i => i.kind === tab);
  const tabLabel = TABS.find(t => t.id === tab)?.label ?? '';

  async function pauseOrResume(i: CommitmentItem) {
    try {
      await api('commitments', { method: 'PATCH', token, body: { id: i.id, active: !i.active } });
      haptic('success');
      reload();
      onToast(i.active ? `${i.name} paused` : `${i.name} resumed`);
    } catch (err) {
      haptic('error');
      onToast(err instanceof Error ? err.message : 'Could not update');
    }
  }

  async function remove(i: CommitmentItem) {
    if (!window.confirm(`Remove ${i.name}? Past postings stay in the Log.`)) return;
    try {
      await api(`commitments?id=${encodeURIComponent(i.id)}`, { method: 'DELETE', token });
      haptic('success');
      reload();
      onToast(`${i.name} removed`);
    } catch (err) {
      haptic('error');
      onToast(err instanceof Error ? err.message : 'Could not remove');
    }
  }

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back to Home"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Commitments</h1>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      {error && <p className="c-danger fs-13" role="alert">{error}</p>}

      <Card as="section" variant="compact" className="mt-8" aria-labelledby="commitments-totals">
        <h2 id="commitments-totals" className="fs-13 c-sec kicker--spaced fw-400">Every month · {monthTitle(currentMonth())}</h2>
        <dl className="grid gap-8 m-0">
          <Total label="Subscriptions" paise={data?.totals.subscriptionsPaise ?? 0} />
          <Total label="Investments (SIP)" paise={data?.totals.investmentsPaise ?? 0} />
          <Total label="Loan EMIs" paise={data?.totals.emisPaise ?? 0} />
        </dl>
      </Card>

      <div role="tablist" aria-label="Commitment type" className="chiprow mt-16">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`chip chip--icon ${tab === t.id ? 'chip--on' : ''}`}
            onClick={() => { setTab(t.id); setAdding(false); }}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'insurance' ? (
        <InsuranceSection
          token={token}
          policies={insurance.data?.items ?? []}
          accounts={accounts.data?.items ?? []}
          categories={home.data?.categories ?? []}
          onChanged={insurance.reload}
          onToast={onToast}
        />
      ) : (
        <>
      <h2 className="kicker mt-16 kicker--spaced">{tabLabel}</h2>

      {items.length === 0 && !adding && <p className="fs-13 c-sec">Nothing added yet.</p>}

      <ul className="grid gap-10 list-reset" aria-label={tabLabel}>
        {items.map(i => (
          <li key={i.id}>
            <ItemCard item={i} onPauseOrResume={() => pauseOrResume(i)} onRemove={() => remove(i)} />
          </li>
        ))}
      </ul>

      {adding ? (
        <AddForm
          token={token}
          kind={tab}
          accounts={accounts.data?.items ?? []}
          categories={home.data?.categories ?? []}
          onCancel={() => setAdding(false)}
          onSaved={name => { setAdding(false); reload(); onToast(`${name} added`); }}
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
        </>
      )}
    </div>
  );
}

function Total({ label, paise }: { label: string; paise: number }) {
  return (
    <div className="flex jc-sb ai-c">
      <dt className="fs-14 c-sec">{label}</dt>
      <dd className="num fs-15 m-0">{formatINR(paise)}</dd>
    </div>
  );
}

function ItemCard({ item: i, onPauseOrResume, onRemove }: { item: CommitmentItem; onPauseOrResume: () => void; onRemove: () => void }) {
  return (
    <Card variant="compact" as="section" aria-label={i.name}>
      <div className="flex ai-c gap-10">
        <div className="flex-1 min-0">
          <h3 className="fs-14 nowrap ovh ellipsis m-0 fw-400">{i.name}</h3>
          <p className="fs-12 c-sec mt-2 m-0">
            {i.kind === 'investment' ? 'Investment' : i.categoryName}
            {i.bucket && ` · ${BUCKET_LABEL[i.bucket]}`} · day {i.dayOfMonth}
          </p>
          <div className="mt-4">
            <StatusBadge item={i} />
          </div>
        </div>
        <div className="num fs-15">{formatINR(i.amountPaise)}</div>
      </div>

      {i.loan && (
        <div className="grid gap-4 mt-8 fs-12 c-sec">
          <p className="m-0">Outstanding <span className="c-text">{formatINR(i.loan.outstandingPaise)}</span> · {(i.loan.rateBps / 100).toFixed(2)}% a year</p>
          <p className="m-0">{i.loan.tenureRemaining} months left · next EMI {shortDate(i.loan.nextEmiDate)}</p>
          <p className="m-0">Next EMI {formatINR(i.amountPaise)}: interest {formatINR(i.loan.nextInterestPaise)}, principal {formatINR(i.loan.nextPrincipalPaise)}</p>
          <p className="m-0">Remaining after next EMI <span className="c-text">{formatINR(i.loan.remainingAfterNextPaise)}</span></p>
        </div>
      )}

      <div className="flex gap-14 mt-8">
        <button className="link" onClick={onPauseOrResume} aria-label={`${i.active ? 'Pause' : 'Resume'} ${i.name}`}>{i.active ? 'Pause' : 'Resume'}</button>
        <button className="link link--danger" onClick={onRemove} aria-label={`Remove ${i.name}`}>Remove</button>
      </div>
    </Card>
  );
}

/** Status: paused is neutral, posted this month is success, otherwise the next due date. */
function StatusBadge({ item: i }: { item: CommitmentItem }) {
  if (!i.active) return <Badge tone="neutral">Paused</Badge>;
  if (i.postedThisMonth) return <Badge tone="success">Posted this month</Badge>;
  return <Badge tone="info">Next {shortDate(i.nextDueDate)}</Badge>;
}

/** Form for one kind. Each field has a visible label. Subscriptions ask for a category (which sets the bucket); loans ask for the loan type. */
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

  const title = kind === 'subscription' ? 'New subscription' : kind === 'investment' ? 'New SIP' : 'New loan';

  return (
    <Card as="section" className="mt-16" aria-labelledby="commitment-form-title">
      <form className="grid gap-10" onSubmit={submit}>
        <h2 id="commitment-form-title" className="kicker m-0">{title}</h2>

        <Field label={kind === 'loan' ? 'Loan name' : kind === 'investment' ? 'Fund name' : 'Name'}>
          <Input placeholder={kind === 'loan' ? 'e.g. Home loan' : kind === 'investment' ? 'e.g. Index fund' : 'e.g. Netflix'} value={name} onChange={e => setName(e.target.value)} required maxLength={60} />
        </Field>

        {kind === 'loan' && (
          <fieldset className="grid gap-8 fieldset-reset">
            <legend className="kicker kicker--spaced">Loan type</legend>
            <div className="chiprow">
              <button type="button" aria-pressed={loanIsNew} className={`chip ${loanIsNew ? 'chip--on' : ''}`} onClick={() => setLoanIsNew(true)}>New loan (money received)</button>
              <button type="button" aria-pressed={!loanIsNew} className={`chip ${!loanIsNew ? 'chip--on' : ''}`} onClick={() => setLoanIsNew(false)}>Existing loan (track only)</button>
            </div>
          </fieldset>
        )}

        {kind === 'loan' && (
          <>
            <Field label={loanIsNew ? 'Loan amount received' : 'Outstanding amount now'}>
              <Input numeric inputMode="decimal" placeholder="e.g. 4500000" value={outstanding} onChange={e => setOutstanding(e.target.value)} required />
            </Field>
            <Field label="Interest rate, % a year">
              <Input numeric inputMode="decimal" placeholder="e.g. 10.5" value={rate} onChange={e => setRate(e.target.value)} required />
            </Field>
            <Field label="Remaining tenure, months">
              <Input numeric inputMode="numeric" placeholder="e.g. 180" value={tenure} onChange={e => setTenure(e.target.value)} required />
            </Field>
          </>
        )}

        <Field label={kind === 'loan' ? 'EMI amount' : kind === 'investment' ? 'Monthly SIP amount' : 'Monthly amount'}>
          <Input numeric inputMode="decimal" placeholder="e.g. 2000" value={amount} onChange={e => setAmount(e.target.value)} required />
        </Field>
        <Field label="Day of month, 1 to 28">
          <Input numeric inputMode="numeric" placeholder="e.g. 5" value={day} onChange={e => setDay(e.target.value)} required />
        </Field>

        {kind !== 'investment' && (
          <fieldset className="grid gap-8 fieldset-reset">
            <legend className="kicker kicker--spaced">{kind === 'loan' ? 'EMI category' : 'Category (sets the bucket)'}</legend>
            <div className="chiprow">
              {categories.map(c => (
                <button type="button" key={c.id} aria-pressed={pickedCategory === c.id} className={`chip ${pickedCategory === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset className="grid gap-8 fieldset-reset">
          <legend className="kicker kicker--spaced">Paid from</legend>
          <div className="chiprow">
            {accounts.map(a => (
              <button type="button" key={a.id} aria-pressed={accountId === a.id} className={`chip ${accountId === a.id ? 'chip--on' : ''}`} onClick={() => setAccountId(a.id)}>{a.nickname}</button>
            ))}
          </div>
        </fieldset>

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
