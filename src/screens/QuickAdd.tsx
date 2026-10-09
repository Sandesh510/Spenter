import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Keypad, applyKey } from '../components/Keypad';
import { Verdict } from '../components/Verdict';
import { api } from '../lib/api';
import { addTransactionToCache, refreshInBackground } from '../lib/cache';
import { pickAccount } from '../lib/defaultAccount';
import { useDefaultAccountId } from '../lib/useDefaultAccount';
import { AddAnotherPrompt } from '../components/ui/AddAnotherPrompt';
import { todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { categoryIcon } from '../lib/categories';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { currentMonth } from '../lib/dates';
import { useApi } from '../lib/useApi';
import type { Account, Bucket, HomeData, TxnRow } from '../lib/types';
import type { Route } from '../App';

type Step = 'amount' | 'details';
const TITLES: Record<Step, string> = { amount: 'Add money', details: 'What for?' };
const STEP_NUMBER: Record<Step, number> = { amount: 1, details: 2 };

const GROUPS: { bucket: Bucket; label: string }[] = [
  { bucket: 'need', label: 'Needs' },
  { bucket: 'want', label: 'Wants' },
  { bucket: 'save', label: 'Savings' },
];

/**
 * Quick Add: two steps. Type the amount, then pick the category on one screen where the account
 * (your default one first) and an optional note are already in place, and save.
 */
export function QuickAdd({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  /** The account chosen on this screen; until then the default account is used. */
  const [accountId, setAccountId] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set after an entry is saved, so the user can add another for today. */
  const [savedNew, setSavedNew] = useState(false);

  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const defaultAccountId = useDefaultAccountId(token);
  // The default account comes first, so it is already selected.
  const firstId = pickAccount(accounts.data?.items ?? [], defaultAccountId);
  const orderedAccounts = [...(accounts.data?.items ?? [])].sort((a, b) => Number(b.id === firstId) - Number(a.id === firstId));
  const paidFrom = accountId ?? firstId;
  const category = home.data?.categories.find(c => c.id === categoryId) ?? null;
  const amountPaise = (() => {
    try {
      return amount ? parseRupeesToPaise(amount) : 0;
    } catch {
      return 0;
    }
  })();

  function back() {
    if (step === 'amount') return go('log');
    setStep('amount');
  }

  /** Yes: start again at the amount. Quick Add always uses today's date, and the account stays. */
  function addAnother() {
    setAmount('');
    setCategoryId(null);
    setDesc('');
    setError(null);
    setStep('amount');
    setSavedNew(false);
  }

  async function save() {
    if (!category || !paidFrom) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ id: string; item?: TxnRow }>('transactions', {
        token,
        body: { type: 'spend', amount, categoryId: category.id, accountId: paidFrom, description: desc.trim() || null },
      });
      haptic('success');
      // Show the result now; the totals catch up in the background.
      if (res.item) addTransactionToCache(res.item);
      refreshInBackground(token);
      onToast(`Added ${formatINR(amountPaise)} · ${category.name}`);
      setSavedNew(true);
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={step === 'amount' ? 'scroll scroll--stack' : 'scroll'}>
      {savedNew && <AddAnotherPrompt date={todayIST()} onYes={addAnother} onNo={() => go('log')} />}
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={back} aria-label={step === 'amount' ? 'Close' : 'Back'}>
          <Icon name={step === 'amount' ? 'x' : 'chevron-left'} size={18} />
        </button>
        <div className="ta-c">
          <h1 className="topbar__title">{TITLES[step]}</h1>
          <div className="kicker kicker--amber fs-11">Step {STEP_NUMBER[step]} of 2</div>
        </div>
        <button className={step === 'amount' ? 'iconbtn iconbtn--hidden' : 'iconbtn'} onClick={() => go('log')} aria-label="Close" tabIndex={step === 'amount' ? -1 : 0}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <AmountDisplay value={amount} big={step === 'amount'} />

      {step === 'amount' && (
        <>
          <p className="ta-c fs-13 c-sec qa-hint">{amountPaise > 0 ? 'Tap Continue when the amount is right.' : 'Type the amount'}</p>
          <Keypad fill onKey={k => setAmount(a => applyKey(a, k))} />
          <Button block disabled={amountPaise <= 0} onClick={() => setStep('details')} className="mt-12">
            Continue <Icon name="arrow-right" size={16} />
          </Button>
          <button className="link link--block mt-16" onClick={() => go('manual')}>
            Adding an older transaction? <strong>Manual entry →</strong>
          </button>
          <button className="link link--block mt-6" onClick={() => go('import')}>
            Have a list? <strong>Paste entries →</strong>
          </button>
          <button className="link link--block mt-6" onClick={() => go('ask')}>
            Thinking about a purchase? <strong>Should I buy this? →</strong>
          </button>
        </>
      )}

      {step === 'details' && (
        <>
          {GROUPS.map(g => {
            const items = home.data?.categories.filter(c => c.bucket === g.bucket) ?? [];
            if (items.length === 0) return null;
            return (
              <fieldset className="chipset mt-12" key={g.bucket}>
                <legend className={`kicker qa-bucket qa-bucket--${g.bucket}`}>{g.label}</legend>
                <div className="flex flex-wrap gap-8">
                  {items.map(c => (
                    <button key={c.id} type="button" className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} aria-pressed={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                      <span className="chip__inner">
                        <Icon name={categoryIcon(c)} size={13} />
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}

          {category && home.data && (
            <div className="mt-14">
              <Verdict
                amountPaise={amountPaise}
                category={{ name: category.name, bucket: category.bucket, plannedPaise: category.plannedPaise, spentPaise: category.spentPaise }}
                spendableBalancePaise={home.data.safeToSpendPaise ?? home.data.spendableBalancePaise}
              />
            </div>
          )}

          <fieldset className="chipset mt-16">
            <legend className="kicker">Paid from</legend>
            <div className="flex flex-wrap gap-8">
              {orderedAccounts.map(a => (
                <button key={a.id} type="button" className={`chip ${paidFrom === a.id ? 'chip--on' : ''}`} aria-pressed={paidFrom === a.id} onClick={() => setAccountId(a.id)}>
                  <span className="chip__inner">
                    <Icon name={a.icon ?? 'wallet'} size={13} />
                    {a.nickname}
                  </span>
                </button>
              ))}
            </div>
            {accounts.data && accounts.data.items.length === 0 && (
              <button className="link mt-8" onClick={() => go('settings')}>Add an account in Settings first →</button>
            )}
          </fieldset>

          <div className="mt-16">
            <Field label="Note (optional)">
              <Input
                placeholder={category ? `e.g. ${category.name}` : 'e.g. Coffee with Ana'}
                value={desc}
                onChange={e => setDesc(e.target.value)}
                maxLength={120}
              />
            </Field>
          </div>

          {error && <p className="c-danger fs-13 mt-12" role="alert">{error}</p>}
          <Button block className="mt-16" disabled={!category || !paidFrom || saving} onClick={save}>
            {saving ? 'Saving…' : category ? `Save ${formatINR(amountPaise)} · ${category.name}` : 'Choose a category'}
          </Button>
        </>
      )}
    </div>
  );
}

/** Amount readout, as in the mockups: ₹ glyph, figure, and a blinking caret while typing. */
function AmountDisplay({ value, big }: { value: string; big: boolean }) {
  return (
    <div className={big ? 'num flex ai-c jc-c gap-2 qa-amount qa-amount--big' : 'num flex ai-c jc-c gap-2 qa-amount'}>
      <span className="heading c-sec qa-amount__sign">₹</span>
      <span className="heading num fw-600 qa-amount__figure">{value ? Number(value).toLocaleString('en-IN') : '0'}</span>
      {big && <span className="caret qa-amount__caret" />}
    </div>
  );
}
