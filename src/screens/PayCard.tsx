import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { useAmountsShown } from '../lib/amountVisibility';
import { addTransactionToCache, refreshInBackground } from '../lib/cache';
import { isCreditCard } from '../lib/accountTypes';
import { pickAccount } from '../lib/defaultAccount';
import { todayIST } from '../lib/dates';
import { haptic } from '../lib/haptics';
import { formatINR, parseRupeesToPaise } from '../lib/money';
import { useApi } from '../lib/useApi';
import { useDefaultAccountId } from '../lib/useDefaultAccount';
import { useOutlook } from './Outlook';
import type { Account, TxnRow } from '../lib/types';
import type { Route } from '../App';

/** What a screen can hand to Pay card bill: which card, and an amount to start with. */
export interface PayCardPrefill {
  cardId?: string;
  amount?: string;
}

/**
 * Pay a credit card bill: a transfer from one of your accounts to the card. The card's owed amount
 * goes down and the account's balance goes down; it is never a spend, so nothing is counted twice.
 */
export function PayCard({ token, go, onToast, prefill }: {
  token: string;
  go: (r: Route) => void;
  onToast: (m: string) => void;
  prefill: PayCardPrefill | null;
}) {
  const result = useOutlook(token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const defaultAccountId = useDefaultAccountId(token);
  const [, , money] = useAmountsShown();
  const [cardId, setCardId] = useState<string | null>(prefill?.cardId ?? null);
  const [fromId, setFromId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(prefill?.amount ?? null);
  const [date, setDate] = useState(todayIST());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cards = result?.outlook.cards ?? [];
  const sources = (accounts.data?.items ?? []).filter(a => !isCreditCard(a.kind));
  // The card with the most billed (else owed) comes first when none was chosen.
  const fallbackCard = [...cards].sort((a, b) => (b.billedPaise ?? b.owedPaise ?? 0) - (a.billedPaise ?? a.owedPaise ?? 0))[0];
  const card = cards.find(c => c.id === (cardId ?? fallbackCard?.id)) ?? null;
  const from = sources.find(a => a.id === fromId) ?? sources.find(a => a.id === pickAccount(sources, defaultAccountId)) ?? null;
  // Start on what is billed, else everything owed; the user can type anything.
  const suggested = card ? (card.billedPaise ?? 0) > 0 ? card.billedPaise : card.owedPaise : null;
  const shownAmount = amount ?? (suggested ? String(suggested / 100) : '');

  let paise = 0;
  try {
    paise = shownAmount ? parseRupeesToPaise(shownAmount) : 0;
  } catch {
    paise = 0;
  }
  const overpay = card?.owedPaise != null && paise > card.owedPaise;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!card) return setError('Choose the card you are paying');
    if (!from) return setError('Choose the account the money is paid from');
    if (paise <= 0) return setError('Enter an amount more than zero');
    if (date > todayIST()) return setError('The date cannot be in the future');
    setBusy(true);
    try {
      const res = await api<{ id: string; item?: TxnRow }>('transactions', {
        token,
        body: { type: 'transfer', amount: shownAmount, date, accountId: from.id, toAccountId: card.id, description: `${card.nickname} bill payment` },
      });
      haptic('success');
      if (res.item) addTransactionToCache(res.item);
      refreshInBackground(token);
      onToast(`Paid ${formatINR(paise)} to ${card.nickname}`);
      go('home');
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('home')} aria-label="Back to Home"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Pay card bill</h1>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      {!result && <p className="fs-13 c-sec mt-12">Loading…</p>}

      {result && cards.length === 0 && (
        <p className="fs-13 c-sec mt-12">You have no credit card account yet. Add one in Settings, Accounts, with the type Credit card.</p>
      )}

      {result && cards.length > 0 && (
        <form className="grid gap-14 mt-8" onSubmit={save}>
          <p className="fs-13 c-sec m-0">Money goes from your account to the card. It is a transfer, not a spend: the card owes less and nothing is counted twice.</p>

          <fieldset className="chipset">
            <legend className="kicker">Card</legend>
            <div className="flex flex-wrap gap-8">
              {cards.map(c => (
                <button key={c.id} type="button" className={`chip ${card?.id === c.id ? 'chip--on' : ''}`} aria-pressed={card?.id === c.id} onClick={() => { setCardId(c.id); setAmount(null); }}>
                  <span className="chip__inner"><Icon name="credit-card" size={13} />{c.nickname}</span>
                </button>
              ))}
            </div>
            {card && (
              <p className="num fs-12 c-sec m-0 mt-8">
                {card.owedPaise === null ? 'No balance set for this card.' : `Owed ${money(card.owedPaise)}`}
                {card.billedPaise !== null && card.billedPaise > 0 && card.billDue ? ` · billed ${money(card.billedPaise)}, due ${card.billDue.slice(8)}/${card.billDue.slice(5, 7)}` : ''}
              </p>
            )}
          </fieldset>

          <fieldset className="chipset">
            <legend className="kicker">Paid from</legend>
            <div className="flex flex-wrap gap-8">
              {sources.map(a => (
                <button key={a.id} type="button" className={`chip ${from?.id === a.id ? 'chip--on' : ''}`} aria-pressed={from?.id === a.id} onClick={() => setFromId(a.id)}>
                  <span className="chip__inner"><Icon name={a.icon ?? 'wallet'} size={13} />{a.nickname}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <Field label="Amount (₹)">
              <Input numeric inputMode="decimal" value={shownAmount} onChange={e => setAmount(e.target.value)} placeholder="0" />
            </Field>
            {card && (
              <div className="flex flex-wrap gap-8 mt-8">
                {(card.billedPaise ?? 0) > 0 && (
                  <button type="button" className="chip" onClick={() => setAmount(String((card.billedPaise as number) / 100))}>Bill {money(card.billedPaise as number)}</button>
                )}
                {(card.owedPaise ?? 0) > 0 && (
                  <button type="button" className="chip" onClick={() => setAmount(String((card.owedPaise as number) / 100))}>All owed {money(card.owedPaise as number)}</button>
                )}
              </div>
            )}
            {overpay && card?.owedPaise != null && (
              <p className="fs-12 c-sec m-0 mt-8">That is more than the {money(card.owedPaise)} the card owes. The extra shows as credit on the card.</p>
            )}
          </div>

          <Field label="Date">
            <Input type="date" value={date} max={todayIST()} onChange={e => setDate(e.target.value)} />
          </Field>

          {error && <p className="c-danger fs-13 m-0" role="alert">{error}</p>}
          <button type="button" className="link link--block" onClick={() => go('fixcards')}>Paid a bill earlier and saved it as spend? Fix it →</button>
          <Button type="submit" size="lg" block disabled={busy || !card || !from || paise <= 0}>
            {busy ? 'Saving…' : paise > 0 && card ? `Pay ${money(paise)} to ${card.nickname}` : 'Pay card bill'}
          </Button>
        </form>
      )}
    </div>
  );
}
