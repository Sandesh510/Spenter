import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Keypad, applyKey } from '../components/Keypad';
import { Verdict } from '../components/Verdict';
import { api } from '../lib/api';
import { iconFor } from '../lib/categories';
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

  async function save(accountId: string) {
    if (!category) return;
    setSaving(true);
    setError(null);
    try {
      await api('transactions', {
        token,
        body: { type: 'spend', amount, categoryId: category.id, accountId, description: desc.trim() || null },
      });
      onToast(`Added ${formatINR(amountPaise)} · ${category.name}`);
      go('log');
    } catch (err) {
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
    <div className="scroll" style={{ paddingBottom: 24 }}>
      <div className="topbar" style={{ padding: '8px 0 4px' }}>
        <button className="iconbtn" onClick={back} aria-label={step === 'amount' ? 'Close' : 'Back'}>
          <Icon name={step === 'amount' ? 'x' : 'chevron-left'} size={18} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <div className="topbar__title">{TITLES[step]}</div>
          <div className="kicker kicker--amber" style={{ fontSize: 10 }}>Step {STEP_NUMBER[step]} of 4</div>
        </div>
        <button className="iconbtn" onClick={() => go('log')} aria-label="Close" style={{ visibility: step === 'amount' ? 'hidden' : 'visible' }}>
          <Icon name="x" size={18} />
        </button>
      </div>

      {step !== 'desc' && step !== 'account' && (
        <AmountDisplay value={amount} big={step === 'amount'} />
      )}

      {step === 'amount' && (
        <>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', margin: '4px 0 12px' }}>
            {amountPaise > 0 ? 'Pause a second — we’ll move on automatically.' : 'Type the amount'}
          </p>
          <Keypad onKey={k => setAmount(a => applyKey(a, k))} />
          {amountPaise > 0 && (
            <button className="btn" onClick={() => setStep('category')} style={{ width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Continue <Icon name="arrow-right" size={16} />
            </button>
          )}
          <button className="link" onClick={() => go('manual')} style={{ display: 'block', margin: '18px auto 0' }}>
            Adding an older transaction? <strong>Manual entry →</strong>
          </button>
        </>
      )}

      {step === 'category' && (
        <>
          {groups.map(g => {
            const items = home.data?.categories.filter(c => c.bucket === g.bucket) ?? [];
            return (
              <div key={g.bucket} style={{ marginTop: 14 }}>
                <div className="kicker" style={{ color: g.bucket === 'need' ? '#aeb9cf' : g.bucket === 'want' ? 'var(--amber)' : 'var(--green)', marginBottom: 8 }}>{g.label}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {items.map(c => (
                    <button key={c.id} className={`chip ${categoryId === c.id ? 'chip--on' : ''}`} onClick={() => setCategoryId(c.id)}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Icon name={iconFor(c.name)} size={13} />
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {category && home.data && (
            <div style={{ marginTop: 16 }}>
              <Verdict
                amountPaise={amountPaise}
                category={{ name: category.name, bucket: category.bucket, plannedPaise: category.plannedPaise, spentPaise: category.spentPaise }}
                spendableBalancePaise={home.data.spendableBalancePaise}
              />
            </div>
          )}
          <button className="btn" disabled={!category} onClick={() => setStep('desc')} style={{ width: '100%', marginTop: 16, opacity: category ? 1 : 0.5 }}>
            Continue
          </button>
        </>
      )}

      {step === 'desc' && (
        <>
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            {category && <span className="chip chip--on" style={{ cursor: 'default' }}>{category.name}</span>}
          </div>
          <div className="kicker" style={{ marginTop: 20 }}>What was it for?</div>
          <input
            className="input"
            autoFocus
            placeholder={category ? `e.g. ${category.name} (optional)` : 'e.g. Coffee with Ana (optional)'}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={120}
            style={{ marginTop: 10 }}
          />
          <button className="btn" onClick={() => setStep('account')} style={{ width: '100%', marginTop: 24 }}>Next</button>
        </>
      )}

      {step === 'account' && (
        <>
          <div style={{ textAlign: 'center', marginTop: 6 }}>
            <div className="num heading" style={{ fontSize: 34 }}>{formatINR(amountPaise)}</div>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
              {category?.name} · {desc.trim() || 'No note'} · Today
            </div>
          </div>
          <div className="kicker" style={{ marginTop: 22 }}>Paid from</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            {(accounts.data?.items ?? []).map(a => (
              <button
                key={a.id}
                disabled={saving}
                onClick={() => save(a.id)}
                className="card"
                style={{ padding: 14, textAlign: 'left', cursor: 'pointer', color: 'var(--text)', fontFamily: 'inherit' }}
              >
                <Icon name={a.icon ?? 'wallet'} size={18} />
                <div style={{ fontSize: 13.5, marginTop: 8 }}>{a.nickname}</div>
                <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{a.bank ?? a.kind ?? ''}</div>
              </button>
            ))}
            {(accounts.data?.items.length ?? 0) < 6 && (
              <button
                onClick={() => go('settings')}
                style={{ padding: 14, borderRadius: 18, border: '1px dashed var(--line)', background: 'transparent', color: 'var(--amber)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
              >
                + Add account
              </button>
            )}
          </div>
          {error && <p role="alert" style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
        </>
      )}
    </div>
  );
}

/** Amount readout, as in the mockups: ₹ glyph, figure, and a blinking caret while typing. */
function AmountDisplay({ value, big }: { value: string; big: boolean }) {
  return (
    <div className="num" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: big ? '18px 0 12px' : '14px 0 10px' }}>
      <span className="heading" style={{ fontSize: big ? 34 : 24, color: 'var(--muted)' }}>₹</span>
      <span className="heading" style={{ fontSize: big ? 66 : 42, lineHeight: 1, fontWeight: 600 }}>{value ? Number(value).toLocaleString('en-IN') : '0'}</span>
      {big && <span className="caret" style={{ height: 52 }} />}
    </div>
  );
}
