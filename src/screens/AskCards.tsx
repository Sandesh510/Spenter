import { useState } from 'react';
import { Icon } from '../components/Icon';
import { recommendCards, type CardSpend } from '../lib/cardRecommend';
import { currentMonth, shiftMonth, todayIST } from '../lib/dates';
import { isCreditCard } from '../lib/accountTypes';
import { formatINR } from '../lib/money';
import type { CardOffer } from '../lib/offers';
import { useApi } from '../lib/useApi';
import type { Account, TxnRow } from '../lib/types';
import { useOutlook } from './Outlook';

const SHOWN = 3;

/**
 * "Which card?" for a purchase being weighed in "Should I buy this?": the cards ranked by what their
 * offers give back on this purchase, how long the card gives before the bill is due, and whether it has
 * the credit. One line says why. Tapping a card chooses it for the purchase.
 */
export function AskCards({ token, amountPaise, categoryId, item, selectedId, onSelect, onOpenOffers }: {
  token: string;
  amountPaise: number;
  categoryId: string | null;
  item: string;
  selectedId: string | null;
  onSelect: (cardId: string) => void;
  onOpenOffers: () => void;
}) {
  const outlook = useOutlook(token);
  const offers = useApi<{ items: CardOffer[] }>('offers', token);
  const accounts = useApi<{ items: Account[] }>('accounts', token);
  const thisMonth = currentMonth();
  const thisTxns = useApi<{ items: TxnRow[] }>(`transactions?month=${thisMonth}`, token);
  const lastTxns = useApi<{ items: TxnRow[] }>(`transactions?month=${shiftMonth(thisMonth, -1)}`, token);
  const [all, setAll] = useState(false);

  if (!accounts.data) return null;
  const cards = accounts.data.items.filter(a => isCreditCard(a.kind));
  if (cards.length === 0) {
    return (
      <p className="fs-12 c-mut m-0 mt-16">
        Add a credit card in Settings, Accounts to see which card suits this purchase.
      </p>
    );
  }
  if (!outlook || !offers.data || !thisTxns.data || !lastTxns.data) return <p className="fs-12 c-mut m-0 mt-16">Checking your cards…</p>;

  const cycleOf = new Map(outlook.outlook.cards.map(c => [c.id, c]));
  const cardIds = new Set(cards.map(c => c.id));
  const spends: CardSpend[] = [...thisTxns.data.items, ...lastTxns.data.items]
    .filter(t => t.type === 'spend' && t.account_id !== null && cardIds.has(t.account_id))
    .map(t => ({ accountId: t.account_id as string, date: t.txn_date, paise: t.amount_paise, categoryId: t.category_id, description: t.description }));

  const ranked = recommendCards({
    purchase: { amountPaise, categoryId, item, today: todayIST() },
    cards: cards.map(c => {
      const o = cycleOf.get(c.id);
      return {
        id: c.id,
        nickname: c.nickname,
        limitPaise: c.credit_limit_paise ?? null,
        owedPaise: o?.owedPaise ?? null,
        newPurchaseDue: o?.newPurchaseDue ?? null,
        statementDay: c.statement_day ?? null,
      };
    }),
    offers: offers.data.items,
    spends,
  });
  const shown = all ? ranked : ranked.slice(0, SHOWN);

  return (
    <section className="mt-16" aria-label="Which card">
      <h2 className="kicker m-0">Which card?</h2>
      <ul className="list-reset grid gap-8 mt-8">
        {shown.map((r, i) => (
          <li key={r.cardId}>
            <button
              type="button"
              className={`card-pick${selectedId === r.cardId ? ' card-pick--on' : ''}${r.blocked ? ' card-pick--blocked' : ''}`}
              aria-pressed={selectedId === r.cardId}
              onClick={() => onSelect(r.cardId)}
            >
              <span className="flex ai-c jc-sb gap-8">
                <span className="fs-14 flex ai-c gap-6">
                  <Icon name="credit-card" size={14} />
                  {r.nickname}
                  {i === 0 && !r.blocked && <span className="card-pick__best">Best</span>}
                </span>
                {r.benefitPaise > 0 && <span className="num fs-13 c-success">{formatINR(r.benefitPaise)} back</span>}
              </span>
              <span className="fs-12 c-sec d-block mt-4">{r.reason}</span>
            </button>
          </li>
        ))}
      </ul>
      {ranked.length > SHOWN && (
        <button className="link mt-4" onClick={() => setAll(a => !a)} aria-expanded={all}>{all ? 'Show top 3' : `Show all ${ranked.length} cards`}</button>
      )}
      {offers.data.items.length === 0 && (
        <p className="fs-12 c-mut m-0 mt-8">
          No offers added yet, so cards are ranked by days to pay. <button className="link" onClick={onOpenOffers}>Add card offers</button>
        </p>
      )}
    </section>
  );
}
