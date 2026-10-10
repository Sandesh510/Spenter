import { useEffect, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { refreshAll } from '../lib/cache';
import { isCreditCard } from '../lib/accountTypes';
import { shortDate } from '../lib/calendar';
import { haptic } from '../lib/haptics';
import { formatINR } from '../lib/money';
import { useApi } from '../lib/useApi';
import type { Account, TxnRow } from '../lib/types';
import type { Route } from '../App';

interface Found {
  items: TxnRow[];
  categories: { id: string; name: string }[];
}

/**
 * Card bill payments that were recorded as a spend (in a category such as "Credit card repayment").
 * A spend counts the money a second time and leaves the card owing the same; turning each one into a
 * transfer to the card puts both right. Nothing changes until the user taps Convert.
 */
export function FixCardPayments({ token, go, onToast }: { token: string; go: (r: Route) => void; onToast: (m: string) => void }) {
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const [found, setFound] = useState<Found | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [cardId, setCardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<Found>('transactions?cardRepayments=1', { token });
      setFound(data);
      setPicked(new Set(data.items.map(t => t.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load');
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const cards = (accounts.data?.items ?? []).filter(a => isCreditCard(a.kind));
  const card = cards.find(c => c.id === cardId) ?? (cards.length === 1 ? cards[0] : null);
  const accountName = (id: string | null) => accounts.data?.items.find(a => a.id === id)?.nickname ?? '';
  const categoryName = (id: string | null) => found?.categories.find(c => c.id === id)?.name ?? '';
  const chosen = (found?.items ?? []).filter(t => picked.has(t.id) && t.account_id !== card?.id);
  const total = chosen.reduce((s, t) => s + t.amount_paise, 0);

  function toggle(id: string) {
    setPicked(p => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function convert() {
    if (!card || chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ converted: number }>('transactions', {
        token,
        body: { action: 'convert_card_payments', ids: chosen.map(t => t.id), cardId: card.id },
      });
      haptic('success');
      // Totals and balances change for several months, so wait for the refresh once.
      await refreshAll(token).catch(() => {});
      onToast(`${res.converted} ${res.converted === 1 ? 'entry' : 'entries'} moved to ${card.nickname}`);
      await load();
    } catch (err) {
      haptic('error');
      setError(err instanceof Error ? err.message : 'Could not convert');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="scroll">
      <div className="topbar topbar--inset">
        <button className="iconbtn" onClick={() => go('settings')} aria-label="Back to Settings"><Icon name="chevron-left" size={18} /></button>
        <h1 className="topbar__title">Card repayments</h1>
        <span className="topbar__spacer" aria-hidden="true" />
      </div>

      <p className="fs-13 c-sec m-0 mt-8">
        These card bill payments were saved as spend. As spend they are counted a second time, and the card still shows the same amount owed. Moving them to the card fixes both.
      </p>

      {!found && !error && <p className="fs-13 c-sec mt-16">Loading…</p>}
      {error && <p className="c-danger fs-13 mt-12" role="alert">{error}</p>}

      {found && found.items.length === 0 && (
        <Card as="section" className="mt-16">
          <p className="fs-14 m-0">Nothing to fix.</p>
          <p className="fs-12 c-sec m-0 mt-4">No spend entries are in a card payment category. New card bill payments are made with Pay card bill.</p>
        </Card>
      )}

      {found && found.items.length > 0 && (
        <>
          <fieldset className="chipset mt-16">
            <legend className="kicker">Which card was paid</legend>
            <div className="flex flex-wrap gap-8">
              {cards.map(c => (
                <button key={c.id} type="button" className={`chip ${card?.id === c.id ? 'chip--on' : ''}`} aria-pressed={card?.id === c.id} onClick={() => setCardId(c.id)}>
                  <span className="chip__inner"><Icon name="credit-card" size={13} />{c.nickname}</span>
                </button>
              ))}
            </div>
            {cards.length === 0 && <p className="fs-12 c-sec m-0 mt-8">Add a credit card account in Settings first.</p>}
          </fieldset>

          <div className="flex ai-c jc-sb mt-16">
            <h2 className="kicker m-0">{found.items.length} {found.items.length === 1 ? 'entry' : 'entries'}</h2>
            <button className="link" onClick={() => setPicked(picked.size === found.items.length ? new Set() : new Set(found.items.map(t => t.id)))}>
              {picked.size === found.items.length ? 'Select none' : 'Select all'}
            </button>
          </div>
          <ul className="list-reset grid gap-8 mt-8">
            {found.items.map(t => {
              const fromCard = card !== null && t.account_id === card.id;
              return (
                <li key={t.id}>
                  <label className={`flex ai-c gap-10 pay-row${fromCard ? ' pay-row--off' : ''}`}>
                    <input type="checkbox" checked={picked.has(t.id) && !fromCard} disabled={fromCard} onChange={() => toggle(t.id)} />
                    <span className="flex-1 min-0">
                      <span className="fs-14 nowrap ovh ellipsis d-block">{t.description ?? categoryName(t.category_id)}</span>
                      <span className="fs-12 c-sec d-block">{shortDate(t.txn_date)} · from {accountName(t.account_id)}{fromCard ? ' (the card itself, cannot be moved)' : ''}</span>
                    </span>
                    <span className="num fs-14">{formatINR(t.amount_paise)}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          {chosen.length > 0 && card && (
            <p className="fs-12 c-sec m-0 mt-12">
              Moving {chosen.length} {chosen.length === 1 ? 'entry' : 'entries'} to {card.nickname}: the card owes {formatINR(total)} less, and your balance left to spend goes up by {formatINR(total)} across the months they were saved in, since the money was counted twice.
            </p>
          )}
          <Button block size="lg" className="mt-12" disabled={busy || !card || chosen.length === 0} onClick={convert}>
            {busy ? 'Moving…' : !card ? 'Choose the card' : `Move ${chosen.length} to ${card.nickname}`}
          </Button>
        </>
      )}
    </div>
  );
}
