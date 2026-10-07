import { useState, type FormEvent } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { pickAccount } from '../lib/defaultAccount';
import { useDefaultAccountId } from '../lib/useDefaultAccount';
import { todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import {
  FREQUENCIES, FREQUENCY_LABEL, POLICY_TYPES, POLICY_TYPE_LABEL, daysUntil,
  type Frequency, type PolicyType,
} from '../lib/insurance';
import { formatINR } from '../lib/money';
import type { Account, Category, InsurancePolicy } from '../lib/types';

/** Insurance policies, shown as the Insurance tab of Commitments. */
export function InsuranceSection({
  token,
  policies,
  accounts,
  categories,
  onChanged,
  onToast,
}: {
  token: string;
  policies: InsurancePolicy[];
  accounts: Account[];
  categories: Category[];
  onChanged: () => void;
  onToast: (m: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  /** The policy whose category is being changed. */
  const [recategorising, setRecategorising] = useState<string | null>(null);

  async function call(body: Record<string, unknown>, method: 'PATCH' | 'DELETE', done: string, query = '') {
    setBusy(true);
    try {
      await api(`insurance${query}`, { token, method, body: method === 'PATCH' ? body : undefined });
      haptic('success');
      onChanged();
      onToast(done);
    } catch (err) {
      haptic('error');
      onToast(err instanceof Error ? err.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="kicker mt-16 kicker--spaced">Insurance</h2>
      {policies.length === 0 && !adding && <p className="fs-13 c-sec">No policies yet.</p>}

      <ul className="grid gap-10 list-reset" aria-label="Insurance policies">
        {policies.map(p => {
          const days = daysUntil(p.next_due_on, todayIST());
          return (
            <li key={p.id}>
              <Card variant="compact" as="section" aria-label={p.name}>
                <div className="flex ai-c gap-10">
                  <div className="flex-1 min-0">
                    <h3 className="fs-14 m-0 fw-400">{p.name}</h3>
                    <p className="fs-12 c-sec m-0">
                      {POLICY_TYPE_LABEL[p.policy_type as PolicyType] ?? p.policy_type}
                      {p.insurer ? ` · ${p.insurer}` : ''}
                      {p.policy_number ? ` · #${p.policy_number}` : ''}
                    </p>
                  </div>
                  {p.auto_debit ? <Badge tone="success">Auto-debit</Badge> : <Badge tone="neutral">Reminder</Badge>}
                </div>
                <dl className="grid gap-4 m-0 mt-8 fs-12">
                  <div className="flex jc-sb"><dt className="c-sec">Premium</dt><dd className="m-0 num">{formatINR(p.premium_paise)} · {FREQUENCY_LABEL[p.frequency as Frequency] ?? p.frequency}</dd></div>
                  <div className="flex jc-sb">
                    <dt className="c-sec">Category</dt>
                    <dd className="m-0">
                      {categories.find(c => c.id === p.category_id)?.name ?? '—'}{' '}
                      <button className="link" disabled={busy} onClick={() => setRecategorising(recategorising === p.id ? null : p.id)}>
                        {recategorising === p.id ? 'Cancel' : 'Change'}
                      </button>
                    </dd>
                  </div>
                  <div className="flex jc-sb">
                    <dt className="c-sec">Next due</dt>
                    <dd className="m-0 num">{p.next_due_on} · {!p.active ? 'paused' : days < 0 ? `${-days} days overdue` : days === 0 ? 'today' : `in ${days} days`}</dd>
                  </div>
                  {p.sum_assured_paise !== null && <div className="flex jc-sb"><dt className="c-sec">Sum assured</dt><dd className="m-0 num">{formatINR(p.sum_assured_paise)}</dd></div>}
                </dl>
                {recategorising === p.id && (
                  <fieldset className="fieldset-reset grid gap-6 mt-8">
                    <legend className="kicker kicker--spaced">File under (past premiums move too)</legend>
                    <div className="chiprow chiprow--wrap">
                      {categories.map(c => (
                        <button
                          type="button"
                          key={c.id}
                          aria-pressed={p.category_id === c.id}
                          className={`chip ${p.category_id === c.id ? 'chip--on' : ''}`}
                          onClick={async () => {
                            if (c.id === p.category_id) return setRecategorising(null);
                            await call({ id: p.id, categoryId: c.id }, 'PATCH', `${p.name} filed under ${c.name}`);
                            setRecategorising(null);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
                <div className="flex gap-14 mt-8">
                  {!p.auto_debit && p.active && (
                    <button className="link" disabled={busy} onClick={() => call({ id: p.id, action: 'paid' }, 'PATCH', `${p.name} premium marked paid`)}>Mark paid</button>
                  )}
                  <button className="link" disabled={busy} onClick={() => call({ id: p.id, active: !p.active }, 'PATCH', p.active ? `${p.name} paused` : `${p.name} resumed`)}>
                    {p.active ? 'Pause' : 'Resume'}
                  </button>
                  <button className="link link--danger" disabled={busy} onClick={() => {
                    if (window.confirm(`Remove ${p.name}? Past premiums stay in the Log.`)) call({}, 'DELETE', `${p.name} removed`, `?id=${encodeURIComponent(p.id)}`);
                  }}>Remove</button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <AddPolicy
          token={token}
          accounts={accounts}
          categories={categories}
          onCancel={() => setAdding(false)}
          onSaved={name => { setAdding(false); onChanged(); onToast(`${name} added`); }}
        />
      ) : (
        <Button variant="secondary" block className="mt-16" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Add insurance
        </Button>
      )}
    </>
  );
}

function AddPolicy({ token, accounts, categories, onCancel, onSaved }: {
  token: string;
  accounts: Account[];
  categories: Category[];
  onCancel: () => void;
  onSaved: (name: string) => void;
}) {
  // Default to the Insurance category. Without one, the user must choose, so premiums never land in an unrelated category.
  const insuranceCategory = categories.find(c => c.name.toLowerCase() === 'insurance');
  const [name, setName] = useState('');
  const [insurer, setInsurer] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyType, setPolicyType] = useState<PolicyType>('health');
  const [premium, setPremium] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('yearly');
  const [nextDueOn, setNextDueOn] = useState(todayIST());
  const [sumAssured, setSumAssured] = useState('');
  const defaultAccountId = useDefaultAccountId(token);
  const [accountId, setAccountId] = useState(pickAccount(accounts, defaultAccountId) ?? '');
  const [categoryId, setCategoryId] = useState(insuranceCategory?.id ?? '');
  const [autoDebit, setAutoDebit] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await api('insurance', {
        token,
        body: {
          name: name.trim(),
          insurer: insurer.trim() || undefined,
          policyNumber: policyNumber.trim() || undefined,
          policyType,
          premium,
          frequency,
          nextDueOn,
          sumAssured: sumAssured.trim() || undefined,
          accountId,
          categoryId,
          autoDebit,
        },
      });
      haptic('success');
      onSaved(name.trim());
    } catch (e2) {
      haptic('error');
      setErr(e2 instanceof Error ? e2.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-10 mt-16">
      <div className="kicker">New policy</div>
      <Field label="Policy name">
        <Input value={name} onChange={e => setName(e.target.value)} required maxLength={60} placeholder="e.g. Family health cover" />
      </Field>
      <Field label="Insurer (optional)">
        <Input value={insurer} onChange={e => setInsurer(e.target.value)} maxLength={60} placeholder="e.g. Star Health" />
      </Field>
      <Field label="Policy number (optional)">
        <Input value={policyNumber} onChange={e => setPolicyNumber(e.target.value)} maxLength={40} />
      </Field>

      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">Policy type</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          {POLICY_TYPES.map(t => (
            <button type="button" key={t} aria-pressed={policyType === t} className={`chip ${policyType === t ? 'chip--on' : ''}`} onClick={() => setPolicyType(t)}>{POLICY_TYPE_LABEL[t]}</button>
          ))}
        </div>
      </fieldset>

      <Field label="Premium (₹)">
        <Input numeric inputMode="decimal" value={premium} onChange={e => setPremium(e.target.value)} required placeholder="e.g. 12000" />
      </Field>

      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">Frequency</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          {FREQUENCIES.map(f => (
            <button type="button" key={f} aria-pressed={frequency === f} className={`chip ${frequency === f ? 'chip--on' : ''}`} onClick={() => setFrequency(f)}>{FREQUENCY_LABEL[f]}</button>
          ))}
        </div>
      </fieldset>

      <Field label="Next due date">
        <Input type="date" value={nextDueOn} onChange={e => setNextDueOn(e.target.value)} required />
      </Field>
      <Field label="Sum assured (optional)">
        <Input numeric inputMode="decimal" value={sumAssured} onChange={e => setSumAssured(e.target.value)} placeholder="e.g. 500000" />
      </Field>

      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">Paid from</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          {accounts.map(a => (
            <button type="button" key={a.id} aria-pressed={accountId === a.id} className={`chip ${accountId === a.id ? 'chip--on' : ''}`} onClick={() => setAccountId(a.id)}>{a.nickname}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">Category</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          {categories.map(c => (
            <button type="button" key={c.id} aria-pressed={categoryId === c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>{c.name}</button>
          ))}
        </div>
      </fieldset>

      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">How it is paid</legend>
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          <button type="button" aria-pressed={!autoDebit} className={`chip ${!autoDebit ? 'chip--on' : ''}`} onClick={() => setAutoDebit(false)}>Remind me, I pay</button>
          <button type="button" aria-pressed={autoDebit} className={`chip ${autoDebit ? 'chip--on' : ''}`} onClick={() => setAutoDebit(true)}>Auto-debit</button>
        </div>
      </fieldset>

      {err && <p className="c-danger fs-13" role="alert" style={{ margin: 0 }}>{err}</p>}
      <div className="flex gap-8">
        <Button variant="secondary" block onClick={onCancel}>Cancel</Button>
        <Button type="submit" block disabled={busy || !accountId || !categoryId}>{busy ? 'Saving…' : 'Save policy'}</Button>
      </div>
    </form>
  );
}

/** Home card: premiums due within the reminder window (7 days, including overdue ones still open). */
export function InsuranceReminders({ policies, onOpen }: { policies: InsurancePolicy[]; onOpen: () => void }) {
  const today = todayIST();
  const due = policies
    .filter(p => p.active && daysUntil(p.next_due_on, today) <= 7)
    .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on));
  if (due.length === 0) return null;
  return (
    <Card as="button" onClick={onOpen} className="card--link" aria-label="Insurance premiums due">
      <div className="flex ai-c jc-sb">
        <span className="fs-13 c-sec">Insurance due soon</span>
        <Icon name="chevron-right" size={16} />
      </div>
      <ul className="list-reset grid gap-4 mt-8">
        {due.map(p => {
          const days = daysUntil(p.next_due_on, today);
          return (
            <li key={p.id} className="fs-12 flex jc-sb">
              <span>{p.name}{p.auto_debit ? ' · auto-debit' : ''}</span>
              <span className="num c-text">{formatINR(p.premium_paise)} · {days < 0 ? `${-days}d overdue` : days === 0 ? 'today' : `${days}d`}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
