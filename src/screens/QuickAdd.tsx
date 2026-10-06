import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Field';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { MAX_ACCOUNTS } from '../lib/limits';
import { Keypad, applyKey } from '../components/Keypad';
import { Verdict } from '../components/Verdict';
import { api } from '../lib/api';
import { refreshAll } from '../lib/cache';
import { AddAnotherPrompt } from '../components/ui/AddAnotherPrompt';
import { todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { categoryIcon } from '../lib/categories';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { currentMonth } from '../lib/dates';
import { useApi } from '../lib/useApi';
import type { Account, Bucket, HomeData } from '../lib/types';
import type { Route } from '../App';

type Step = 'amount' | 'category' | 'desc' | 'account';
const TITLES: Record<Step, string> = { amount: 'Add money', category: 'What kind?', desc: 'Add a note', account: 'Paid from' };
const STEP_NUMBER: Record<Step, number> = { amount: 1, category: 2, desc: 3, account: 4 };
const AUTO_ADVANCE_MS = 2000;

/** Quick Add: four steps, keypad-first. Behaviour from the README; layout from the mockups. */
export function QuickAdd({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set after an entry is saved, so the user can add another for today. */
  const [savedNew, setSavedNew] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const home = useApi<HomeData>(`home?month=${currentMonth()}`, token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const category = home.data?.categories.find(c => c.id === categoryId) ?? null;
  const amountPaise = (() => {
    try {
      return amount ? parseRupeesToPaise(amount) : 0;
    } catch {
      return 0;
    }
  })();

  // Auto-advance 2s after the last keypress on step 1 (README). Any other input cancels it.
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (step === 'amount' && amountPaise > 0) {
      timer.current = window.setTimeout(() => setStep('category'), AUTO_ADVANCE_MS);
    }
    return () => window.clearTimeout(timer.current);
  }, [step, amount, amountPaise]);

  function back() {
    window.clearTimeout(timer.current);
    if (step === 'amount') return go('log');
    setStep(step === 'account' ? 'desc' : step === 'desc' ? 'category' : 'amount');
  }

  /** Yes: start again at the amount. Quick Add always uses today's date. */
  function addAnother() {
    setAmount('');
    setCategoryId(null);
    setDesc('');
    setError(null);
    setStep('amount');
    setSavedNew(false);
  }

  async function save(accountId: string) {
    if (!category) return;
    setSaving(true);
    setError(null);
    try {
      await api('transactions', {
        token,
        body: { type: 'spend', amount, categoryId: category.id, accountId, description: desc.trim() || null },
      });
      haptic('success');
      await refreshAll(token).catch(() => {});
      onToast(`Added ${formatINR(amountPaise)} · ${category.name}`);
      setSavedNew(true);
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const groups: { bucket: Bucket; label: string }[] = [
    { bucket: 'need', label: 'Needs' },
    { bucket: 'want', label: 'Wants' },
    { bucket: 'save', label: 'Savings' },
  ];

  return (
    <div className={step === 'amount' ? 'scroll scroll--stack' : 'scroll'} style={{ paddingBottom: 24 }}>
      {savedNew && <AddAnotherPrompt date={todayIST()} onYes={addAnother} onNo={() => go('log')} />}
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={back} aria-label={step === 'amount' ? 'Close' : 'Back'}>
          <Icon name={step === 'amount' ? 'x' : 'chevron-left'} size={18} />
        </button>
        <div className="ta-c">
          <div className="topbar__title">{TITLES[step]}</div>
          <div className="kicker kicker--amber fs-11">Step {STEP_NUMBER[step]} of 4</div>
        </div>
        <button className="iconbtn" onClick={() => go('log')} aria-label="Close" style={{ visibility: step === 'amount' ? 'hidden' : 'visible' }}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {step !== 'account' && (
        <AmountDisplay value={amount} big={step === 'amount'} />
      )}

      {step === 'amount' && (
        <>
          <p className="ta-c fs-13 c-sec" style={{ margin: '4px 0 12px' }}>
            {amountPaise > 0 ? 'Pause a second — we’ll move on automatically.' : 'Type the amount'}
          </p>
          <Keypad fill onKey={k => setAmount(a => applyKey(a, k))} />
          {amountPaise > 0 && (
            <Button block onClick={() => setStep('category')} style={{ marginTop: 12 }}>
              Continue <Icon name="arrow-right" size={16} />
            </Button>
          )}
          <button className="link" onClick={() => go('manual')} style={{ display: 'block', margin: '18px auto 0' }}>
            Adding an older transaction? <strong>Manual entry →</strong>
          </button>
          <button className="link" onClick={() => go('import')} style={{ display: 'block', margin: '6px auto 0' }}>
            Have a list? <strong>Paste entries →</strong>
          </button>
          <button className="link" onClick={() => go('ask')} style={{ display: 'block', margin: '6px auto 0' }}>
            Thinking about a purchase? <strong>Should I buy this? →</strong>
          </button>
        </>
      )}

      {step === 'category' && (
        <>
          {groups.map(g => {
            const items = home.data?.categories.filter(c => c.bucket === g.bucket) ?? [];
            return (
              <div className="mt-14" key={g.bucket} >
                <div className="kicker" style={{ color: g.bucket === 'need' ? 'var(--color-need)' : g.bucket === 'want' ? 'var(--color-accent)' : 'var(--color-success)', marginBottom: 8 }}>{g.label}</div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  {items.map(c => (
                    <button key={c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>
                      <span className="ai-c gap-6" style={{ display: 'inline-flex' }}>
                        <Icon name={categoryIcon(c)} size={13} />
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {category && home.data && (
            <div className="mt-16">
              <Verdict
                amountPaise={amountPaise}
                category={{ name: category.name, bucket: category.bucket, plannedPaise: category.plannedPaise, spentPaise: category.spentPaise }}
                spendableBalancePaise={home.data.safeToSpendPaise ?? home.data.spendableBalancePaise}
              />
            </div>
          )}
          <Button block disabled={!category} onClick={() => setStep('desc')} style={{ marginTop: 16 }}>
            Continue
          </Button>
        </>
      )}

      {step === 'desc' && (
        <>
          <div className="ta-c fs-12 c-sec mt-6">
            {category && <span className="chip chip--on" style={{ cursor: 'default' }}>{category.name}</span>}
          </div>
          <div className="kicker mt-20">What was it for?</div>
          <Input
            
            autoFocus
            placeholder={category ? `e.g. ${category.name} (optional)` : 'e.g. Coffee with Ana (optional)'}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={120}
            style={{ marginTop: 10 }}
          />
          <Button block onClick={() => setStep('account')} style={{ marginTop: 24 }}>Next</Button>
        </>
      )}

      {step === 'account' && (
        <>
          <div className="ta-c mt-6">
            <div className="num heading fs-34">{formatINR(amountPaise)}</div>
            <div className="fs-13 c-sec mt-4">
              {category?.name} · {desc.trim() || 'No note'} · Today
            </div>
          </div>
          <div className="kicker mt-22">Paid from</div>
          <div className="grid gap-10 mt-10" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {(accounts.data?.items ?? []).map(a => (
              <Card
                as="button"
                key={a.id}
                disabled={saving}
                onClick={() => save(a.id)}
                style={{ padding: 14, textAlign: 'left', cursor: 'pointer', color: 'var(--color-text-primary)', fontFamily: 'inherit' }}
              >
                <Icon name={a.icon ?? 'wallet'} size={18} />
                <div className="fs-14 mt-8">{a.nickname}</div>
                <div className="fs-11 c-mut mt-2">{a.bank ?? a.kind ?? ''}</div>
              </Card>
            ))}
            {(accounts.data?.items.length ?? 0) < MAX_ACCOUNTS && (
              <button
                onClick={() => go('settings')}
                style={{ padding: 14, borderRadius: 18, border: '1px dashed var(--color-border)', background: 'transparent', color: 'var(--color-accent-text)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
              >
                + Add account
              </button>
            )}
          </div>
          {error && <p className="c-danger fs-13 mt-12" role="alert">{error}</p>}
        </>
      )}
    </div>
  );
}

/** Amount readout, as in the mockups: ₹ glyph, figure, and a blinking caret while typing. */
function AmountDisplay({ value, big }: { value: string; big: boolean }) {
  return (
    <div className="num flex ai-c jc-c gap-2" style={{ padding: big ? '18px 0 12px' : '14px 0 10px' }}>
      <span className="heading c-sec" style={{ fontSize: big ? 34 : 24 }}>₹</span>
      <span className="heading fw-600" style={{ fontSize: big ? 66 : 42, lineHeight: 1 }}>{value ? Number(value).toLocaleString('en-IN') : '0'}</span>
      {big && <span className="caret" style={{ height: 52 }} />}
    </div>
  );
}
