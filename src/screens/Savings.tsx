import { useState, type FormEvent } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { currentMonth, todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { cache } from '../lib/cache';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import {
  DEFAULT_EMERGENCY_MONTHS, MAX_EMERGENCY_MONTHS, MIN_EMERGENCY_MONTHS, PLAN_SORTS, PLAN_SORT_LABEL,
  amountLeft, displayProgress, emergencySuggestion, isOnTrack, monthsCovered, monthsRemaining, progressRatio, sortPlans,
  type PlanKind, type PlanSort,
} from '../lib/savings';
import { useApi } from '../lib/useApi';
import type { Account, Category, HomeData, SavingsData, SavingsPlan } from '../lib/types';
import type { Route } from '../App';

/**
 * Savings goals and the emergency fund. A contribution is a spend in the plan's Savings category,
 * so it leaves the balance and counts toward the Savings budget. Saved = already saved + contributions.
 */
export function Savings({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const { data, error, reload } = useApi<SavingsData>('savings', token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const [sort, setSort] = useState<PlanSort>('priority');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const plans = data?.items ?? [];
  const sorted = sortPlans(plans, sort);
  const byPriority = sortPlans(plans, 'priority');
  const accountList = accounts.data?.items ?? [];
  const saveCategories = (home.data?.categories ?? []).filter(c => c.bucket === 'save');
  const average = data?.averageMonthlySpendPaise ?? 0;
  const hasEmergency = plans.some(p => p.kind === 'emergency');
  const totalSaved = plans.reduce((s, p) => s + p.saved_paise, 0);
  const totalTarget = plans.reduce((s, p) => s + p.target_paise, 0);

  /**
   * Refreshes the plans, which bootstrap does not carry, and then everything else
   * (a contribution changes the balance and the Savings budget on Home).
   */
  function refresh() {
    api<SavingsData>('savings', { token }).then(d => cache.set('savings', d)).catch(() => undefined);
    reload();
  }

  async function call(path: string, method: 'PATCH' | 'DELETE', body: Record<string, unknown> | undefined, done: string): Promise<boolean> {
    setBusy(true);
    try {
      await api(path, { token, method, body });
      haptic('success');
      refresh();
      onToast(done);
      return true;
    } catch (err) {
      haptic('error');
      onToast(err instanceof Error ? err.message : 'Could not update');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back to Home"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Savings plans</h1>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      {error && <p className="c-danger fs-13" role="alert">{error}</p>}
      {!data && !error && <p className="fs-13 c-sec">Loading…</p>}

      {data && (
        <Card as="section" variant="compact" className="mt-8" aria-labelledby="savings-totals">
          <h2 id="savings-totals" className="fs-13 c-sec kicker--spaced fw-400">All plans</h2>
          <dl className="grid gap-8 m-0">
            <div className="flex jc-sb ai-c">
              <dt className="fs-14 c-sec">Saved</dt>
              <dd className="num fs-15 m-0">{formatINR(totalSaved)} <span className="c-sec fs-13">of {formatINR(totalTarget)}</span></dd>
            </div>
            <div className="flex jc-sb ai-c">
              <dt className="fs-14 c-sec">Average monthly spend</dt>
              <dd className="num fs-15 m-0">{formatINR(average)}</dd>
            </div>
          </dl>
        </Card>
      )}

      {plans.length > 1 && (
        <fieldset className="fieldset-reset mt-16">
          <legend className="kicker kicker--spaced">Sort by</legend>
          <div className="chiprow chiprow--wrap">
            {PLAN_SORTS.map(s => (
              <button key={s} type="button" aria-pressed={sort === s} className={`chip ${sort === s ? 'chip--on' : ''}`} onClick={() => setSort(s)}>
                {PLAN_SORT_LABEL[s]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <h2 className="kicker mt-16 kicker--spaced">Your plans</h2>
      {data && plans.length === 0 && !adding && (
        <p className="fs-13 c-sec">No plans yet. Start with an emergency fund: a few months of expenses set aside.</p>
      )}

      <ul className="grid gap-10 list-reset" aria-label="Savings plans">
        {sorted.map(p => {
          const rank = byPriority.findIndex(x => x.id === p.id);
          return (
            <li key={p.id}>
              <PlanCard
                token={token}
                plan={p}
                accounts={accountList}
                saveCategories={saveCategories}
                averagePaise={average}
                showMove={sort === 'priority' && plans.length > 1}
                isFirst={rank === 0}
                isLast={rank === byPriority.length - 1}
                busy={busy}
                onMove={dir => call('savings', 'PATCH', { id: p.id, move: dir }, `${p.name} moved ${dir}`)}
                onRemove={() => {
                  if (window.confirm(`Remove ${p.name}? Past contributions stay in the Log as savings.`)) {
                    call(`savings?id=${encodeURIComponent(p.id)}`, 'DELETE', undefined, `${p.name} removed`);
                  }
                }}
                onChanged={msg => { refresh(); onToast(msg); }}
              />
            </li>
          );
        })}
      </ul>

      {adding ? (
        <PlanForm
          token={token}
          hasEmergency={hasEmergency}
          accounts={accountList}
          saveCategories={saveCategories}
          averagePaise={average}
          onCancel={() => setAdding(false)}
          onSaved={name => { setAdding(false); refresh(); onToast(`${name} added`); }}
        />
      ) : (
        <Button variant="secondary" block className="mt-16" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Add plan
        </Button>
      )}
    </div>
  );
}

function PlanCard({ token, plan: p, accounts, saveCategories, averagePaise, showMove, isFirst, isLast, busy, onMove, onRemove, onChanged }: {
  token: string;
  plan: SavingsPlan;
  accounts: Account[];
  saveCategories: Category[];
  averagePaise: number;
  showMove: boolean;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onMove: (dir: 'up' | 'down') => void;
  onRemove: () => void;
  onChanged: (message: string) => void;
}) {
  const [mode, setMode] = useState<'view' | 'contribute' | 'edit'>('view');
  const today = todayIST();
  const left = amountLeft(p.saved_paise, p.target_paise);
  const ratio = progressRatio(p.saved_paise, p.target_paise);
  const reached = left === 0;
  const remaining = monthsRemaining(left, p.monthly_contribution_paise);
  const onTrack = isOnTrack({ leftPaise: left, monthlyPaise: p.monthly_contribution_paise, targetDate: p.target_date, today });
  const covered = p.kind === 'emergency' ? monthsCovered(p.saved_paise, averagePaise) : null;
  const account = accounts.find(a => a.id === p.account_id);

  if (mode === 'edit') {
    return (
      <PlanForm
        token={token}
        plan={p}
        hasEmergency
        accounts={accounts}
        saveCategories={saveCategories}
        averagePaise={averagePaise}
        onCancel={() => setMode('view')}
        onSaved={name => { setMode('view'); onChanged(`${name} saved`); }}
      />
    );
  }

  return (
    <Card variant="compact" as="section" aria-label={p.name}>
      <div className="flex ai-c gap-10">
        <h3 className="fs-14 m-0 fw-400 flex-1 min-0 nowrap ovh ellipsis">{p.name}</h3>
        {p.kind === 'emergency' && <Badge tone="info">Emergency fund</Badge>}
        {reached && <Badge tone="success">Reached</Badge>}
      </div>

      <div className="num fs-13 c-sec mt-8">
        <span className="c-text fs-15">{formatINR(p.saved_paise)}</span> of {formatINR(p.target_paise)} · {Math.round(ratio * 100)}%
      </div>
      <div
        className="track mt-8"
        role="progressbar"
        aria-label={`${p.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(displayProgress(p.saved_paise, p.target_paise) * 100)}
      >
        <div className={`fill ${reached ? 'fill--success' : ''}`} style={{ width: `${displayProgress(p.saved_paise, p.target_paise) * 100}%` }} />
      </div>

      <dl className="grid gap-4 m-0 mt-8 fs-12">
        <div className="flex jc-sb"><dt className="c-sec">Left</dt><dd className="m-0 num">{formatINR(left)}</dd></div>
        <div className="flex jc-sb">
          <dt className="c-sec">Months to go</dt>
          <dd className="m-0 num">{remaining === null ? 'set a monthly amount' : remaining === 0 ? 'none' : `${remaining} ${remaining === 1 ? 'month' : 'months'}`}</dd>
        </div>
        <div className="flex jc-sb ai-c gap-8">
          <dt className="c-sec">Target date</dt>
          <dd className="m-0 num flex ai-c gap-6">
            {p.target_date ? shortDate(p.target_date) : 'none'}
            {onTrack !== null && !reached && <Badge tone={onTrack ? 'success' : 'neutral'}>{onTrack ? 'On track' : 'Behind'}</Badge>}
          </dd>
        </div>
        <div className="flex jc-sb">
          <dt className="c-sec">Monthly contribution</dt>
          <dd className="m-0 num">{p.monthly_contribution_paise ? formatINR(p.monthly_contribution_paise) : 'not set'}</dd>
        </div>
        {p.kind === 'emergency' && (
          <div className="flex jc-sb">
            <dt className="c-sec">Covers</dt>
            <dd className="m-0 num">{covered === null ? 'no spending yet' : `${covered} of ${p.emergency_months ?? DEFAULT_EMERGENCY_MONTHS} months of expenses`}</dd>
          </div>
        )}
        <div className="flex jc-sb">
          <dt className="c-sec">Account</dt>
          <dd className="m-0">{account?.nickname ?? '—'}</dd>
        </div>
      </dl>

      {mode === 'contribute' ? (
        <ContributeForm
          token={token}
          plan={p}
          accounts={accounts}
          onCancel={() => setMode('view')}
          onSaved={amount => { setMode('view'); onChanged(`${formatINR(amount)} added to ${p.name}`); }}
        />
      ) : (
        <div className="flex flex-wrap gap-14 mt-8">
          <button className="link" disabled={busy} onClick={() => setMode('contribute')}>Add contribution</button>
          <button className="link" disabled={busy} onClick={() => setMode('edit')} aria-label={`Edit ${p.name}`}>Edit</button>
          {showMove && !isFirst && (
            <button className="link flex ai-c gap-2" disabled={busy} onClick={() => onMove('up')} aria-label={`Move ${p.name} up`}>
              <Icon name="chevron-up" size={14} /> Up
            </button>
          )}
          {showMove && !isLast && (
            <button className="link flex ai-c gap-2" disabled={busy} onClick={() => onMove('down')} aria-label={`Move ${p.name} down`}>
              <Icon name="chevron-down" size={14} /> Down
            </button>
          )}
          <button className="link link--danger" disabled={busy} onClick={onRemove} aria-label={`Remove ${p.name}`}>Remove</button>
        </div>
      )}
    </Card>
  );
}

/** Records one contribution: a spend in the plan's Savings category, linked to the plan. */
function ContributeForm({ token, plan, accounts, onCancel, onSaved }: {
  token: string;
  plan: SavingsPlan;
  accounts: Account[];
  onCancel: () => void;
  onSaved: (amountPaise: number) => void;
}) {
  const today = todayIST();
  const [amount, setAmount] = useState(plan.monthly_contribution_paise ? paiseToInput(plan.monthly_contribution_paise) : '');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState(plan.account_id);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (date > today) return setErr("The date can't be in the future");
    setBusy(true);
    try {
      await api('savings', { token, method: 'PATCH', body: { id: plan.id, action: 'contribute', amount, date, accountId } });
      haptic('success');
      onSaved(parseRupeesToPaise(amount));
    } catch (e2) {
      haptic('error');
      setErr(e2 instanceof Error ? e2.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-10 mt-12" aria-label={`Add contribution to ${plan.name}`}>
      <Field label="Amount (₹)">
        <Input numeric inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="e.g. 5000" />
      </Field>
      <Field label="Date">
        <Input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} required />
      </Field>
      <fieldset className="fieldset-reset grid gap-6">
        <legend className="kicker kicker--spaced">Paid from</legend>
        <div className="chiprow chiprow--wrap">
          {accounts.map(a => (
            <button type="button" key={a.id} aria-pressed={accountId === a.id} className={`chip ${accountId === a.id ? 'chip--on' : ''}`} onClick={() => setAccountId(a.id)}>{a.nickname}</button>
          ))}
        </div>
      </fieldset>
      <p className="fs-12 c-mut m-0">Saved as a spend in this plan's Savings category, so it leaves your balance.</p>
      {err && <p className="c-danger fs-13 m-0" role="alert">{err}</p>}
      <div className="flex gap-8">
        <Button variant="secondary" block onClick={onCancel}>Cancel</Button>
        <Button type="submit" block disabled={busy}>{busy ? 'Saving…' : 'Add'}</Button>
      </div>
    </form>
  );
}

/** Add a plan, or edit one when `plan` is given. The kind is fixed once a plan exists. */
function PlanForm({ token, plan, hasEmergency, accounts, saveCategories, averagePaise, onCancel, onSaved }: {
  token: string;
  plan?: SavingsPlan;
  hasEmergency: boolean;
  accounts: Account[];
  saveCategories: Category[];
  averagePaise: number;
  onCancel: () => void;
  onSaved: (name: string) => void;
}) {
  const editing = plan !== undefined;
  const defaultCategory = saveCategories.find(c => c.name.toLowerCase() === 'investment') ?? saveCategories[0];
  const initialMonths = plan?.emergency_months ?? DEFAULT_EMERGENCY_MONTHS;

  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? (hasEmergency ? 'goal' : 'emergency'));
  const [name, setName] = useState(plan?.name ?? (hasEmergency ? '' : 'Emergency fund'));
  const [months, setMonths] = useState(String(initialMonths));
  // A new emergency fund's target follows the suggestion until the user types their own.
  const [targetTouched, setTargetTouched] = useState(editing);
  const [target, setTarget] = useState(
    plan ? paiseToInput(plan.target_paise) : !hasEmergency && averagePaise > 0 ? paiseToInput(emergencySuggestion(averagePaise, initialMonths)) : '',
  );
  const [opening, setOpening] = useState(plan && plan.opening_paise > 0 ? paiseToInput(plan.opening_paise) : '');
  const [monthly, setMonthly] = useState(plan?.monthly_contribution_paise ? paiseToInput(plan.monthly_contribution_paise) : '');
  const [targetDate, setTargetDate] = useState(plan?.target_date ?? '');
  const [accountId, setAccountId] = useState(plan?.account_id ?? accounts[0]?.id ?? '');
  const [categoryId, setCategoryId] = useState(plan?.category_id ?? defaultCategory?.id ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const monthsNum = Number(months);
  const monthsValid = Number.isInteger(monthsNum) && monthsNum >= MIN_EMERGENCY_MONTHS && monthsNum <= MAX_EMERGENCY_MONTHS;
  const suggestion = monthsValid ? emergencySuggestion(averagePaise, monthsNum) : 0;

  function chooseKind(k: PlanKind) {
    setKind(k);
    if (k === 'emergency') {
      if (!name.trim()) setName('Emergency fund');
      if (!targetTouched && suggestion > 0) setTarget(paiseToInput(suggestion));
    } else if (name === 'Emergency fund') {
      setName('');
      if (!targetTouched) setTarget('');
    }
  }

  function changeMonths(value: string) {
    setMonths(value);
    const n = Number(value);
    if (!targetTouched && Number.isInteger(n) && n >= MIN_EMERGENCY_MONTHS && n <= MAX_EMERGENCY_MONTHS && averagePaise > 0) {
      setTarget(paiseToInput(emergencySuggestion(averagePaise, n)));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (kind === 'emergency' && !monthsValid) return setErr(`Months must be a whole number from ${MIN_EMERGENCY_MONTHS} to ${MAX_EMERGENCY_MONTHS}`);
    setBusy(true);
    const fields = {
      name: name.trim(),
      target: target.trim() || undefined,
      ...(kind === 'emergency' ? { months: monthsNum } : {}),
      opening: opening.trim() || '0',
      monthly: monthly.trim() || null,
      targetDate: targetDate || null,
      accountId,
      categoryId,
    };
    try {
      if (plan) await api('savings', { token, method: 'PATCH', body: { id: plan.id, ...fields } });
      else await api('savings', { token, body: { kind, ...fields } });
      haptic('success');
      onSaved(name.trim());
    } catch (e2) {
      haptic('error');
      setErr(e2 instanceof Error ? e2.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const noSaveCategory = saveCategories.length === 0;

  return (
    <Card as="section" className={editing ? '' : 'mt-16'} aria-labelledby={editing ? `plan-form-${plan.id}` : 'plan-form-new'}>
      <form onSubmit={submit} className="grid gap-10">
        {editing ? (
          <h3 id={`plan-form-${plan.id}`} className="kicker m-0 fw-400">Edit {plan.name}</h3>
        ) : (
          <h2 id="plan-form-new" className="kicker m-0">New plan</h2>
        )}

        {!editing && (
          <fieldset className="fieldset-reset grid gap-6">
            <legend className="kicker kicker--spaced">Plan type</legend>
            <div className="chiprow chiprow--wrap">
              <button type="button" aria-pressed={kind === 'goal'} className={`chip ${kind === 'goal' ? 'chip--on' : ''}`} onClick={() => chooseKind('goal')}>Goal</button>
              {!hasEmergency && (
                <button type="button" aria-pressed={kind === 'emergency'} className={`chip ${kind === 'emergency' ? 'chip--on' : ''}`} onClick={() => chooseKind('emergency')}>Emergency fund</button>
              )}
            </div>
          </fieldset>
        )}

        <Field label="Name">
          <Input value={name} onChange={e => setName(e.target.value)} required maxLength={60} placeholder={kind === 'emergency' ? 'Emergency fund' : 'e.g. New laptop'} />
        </Field>

        {kind === 'emergency' && (
          <>
            <Field label={`Months of expenses, ${MIN_EMERGENCY_MONTHS} to ${MAX_EMERGENCY_MONTHS}`}>
              <Input numeric inputMode="numeric" value={months} onChange={e => changeMonths(e.target.value)} required />
            </Field>
            {averagePaise > 0 ? (
              <p className="fs-12 c-sec m-0">
                Suggested target <span className="c-text num">{formatINR(suggestion)}</span> = {monthsValid ? monthsNum : '?'} × average monthly spend{' '}
                <span className="c-text num">{formatINR(averagePaise)}</span> (Needs + Wants).
                {targetTouched && suggestion > 0 && target !== paiseToInput(suggestion) && (
                  <>
                    {' '}
                    <button type="button" className="link fs-12" onClick={() => setTarget(paiseToInput(suggestion))}>Use suggested</button>
                  </>
                )}
              </p>
            ) : (
              <p className="fs-12 c-sec m-0">No spending recorded yet, so there is no suggestion. Enter a target.</p>
            )}
          </>
        )}

        <Field label="Target (₹)">
          <Input numeric inputMode="decimal" value={target} onChange={e => { setTarget(e.target.value); setTargetTouched(true); }} required placeholder="e.g. 300000" />
        </Field>
        <Field label="Already saved (₹, optional)">
          <Input numeric inputMode="decimal" value={opening} onChange={e => setOpening(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Monthly contribution (₹, optional)">
          <Input numeric inputMode="decimal" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="e.g. 10000" />
        </Field>
        <Field label="Target date (optional)">
          <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
        </Field>

        <fieldset className="fieldset-reset grid gap-6">
          <legend className="kicker kicker--spaced">Paid from</legend>
          {accounts.length === 0 ? (
            <p className="fs-13 c-sec m-0">Add an account in Settings first.</p>
          ) : (
            <div className="chiprow chiprow--wrap">
              {accounts.map(a => (
                <button type="button" key={a.id} aria-pressed={accountId === a.id} className={`chip ${accountId === a.id ? 'chip--on' : ''}`} onClick={() => setAccountId(a.id)}>{a.nickname}</button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="fieldset-reset grid gap-6">
          <legend className="kicker kicker--spaced">Savings category</legend>
          {noSaveCategory ? (
            <p className="fs-13 c-sec m-0">You have no Savings category yet. Add one in Settings (bucket: Savings), then come back.</p>
          ) : (
            <div className="chiprow chiprow--wrap">
              {saveCategories.map(c => (
                <button type="button" key={c.id} aria-pressed={categoryId === c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>{c.name}</button>
              ))}
            </div>
          )}
        </fieldset>

        {err && <p className="c-danger fs-13 m-0" role="alert">{err}</p>}
        <div className="flex gap-8">
          <Button variant="secondary" block onClick={onCancel}>Cancel</Button>
          <Button type="submit" block disabled={busy || !accountId || !categoryId || noSaveCategory}>{busy ? 'Saving…' : editing ? 'Save' : 'Add plan'}</Button>
        </div>
      </form>
    </Card>
  );
}

/** Home card: what all plans have saved, and how many months of expenses the emergency fund covers. */
export function SavingsCard({ token, onOpen }: { token: string; onOpen: () => void }) {
  const { data } = useApi<SavingsData>('savings', token);
  const plans = data?.items ?? [];
  const saved = plans.reduce((s, p) => s + p.saved_paise, 0);
  const target = plans.reduce((s, p) => s + p.target_paise, 0);
  const emergency = plans.find(p => p.kind === 'emergency');
  const covered = emergency ? monthsCovered(emergency.saved_paise, data?.averageMonthlySpendPaise ?? 0) : null;
  return (
    <Card as="button" onClick={onOpen} className="card--link">
      <div className="flex ai-c jc-sb">
        <span className="fs-13 c-sec">Savings plans</span>
        <Icon name="chevron-right" size={16} />
      </div>
      {plans.length === 0 ? (
        <p className="fs-12 c-sec m-0 mt-8">Set up an emergency fund or a savings goal.</p>
      ) : (
        <div className="num fs-12 c-sec mt-8 grid gap-4">
          <span>Saved <span className="c-text">{formatINR(saved)}</span> of {formatINR(target)}</span>
          {emergency && (
            <span>
              Emergency fund covers <span className="c-text">{covered === null ? '—' : `${covered} months`}</span> of expenses
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/** Paise as a plain rupee string for an input: 1234500 → "12345", 1234550 → "12345.50". */
function paiseToInput(paise: number): string {
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
