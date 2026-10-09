import { describe, expect, it } from 'vitest';
import { cardSummary, type CardTxn } from './cardSummary';

const card = new Set(['card']);
const spend = (amountPaise: number, accountId: string, categoryId?: string): CardTxn => ({ type: 'spend', amountPaise, accountId, toAccountId: null, external: false, categoryId });
const transfer = (amountPaise: number, accountId: string, toAccountId: string | null, external = false): CardTxn => ({ type: 'transfer', amountPaise, accountId, toAccountId, external });

describe('cardSummary', () => {
  it('is null without a card account', () => {
    expect(cardSummary(new Set(), [spend(100, 'bank')], [])).toBeNull();
  });

  it('counts card spend and ignores other accounts', () => {
    expect(cardSummary(card, [spend(1_200_000, 'card'), spend(50_000, 'bank')], [])).toEqual({ spentPaise: 1_200_000, otherPaise: 0, paidPaise: 0, duePaise: 1_200_000, byCategoryPaise: {} });
  });

  it('money lent from the card is owed on the bill but is not card spend', () => {
    const s = cardSummary(card, [spend(100_000, 'card')], [{ amountPaise: 8_400_000, debitAccountId: 'card' }, { amountPaise: 90_000, debitAccountId: 'bank' }]);
    expect(s).toMatchObject({ spentPaise: 100_000, otherPaise: 8_400_000, duePaise: 8_500_000 });
  });

  it('groups card spend by category and leaves other accounts out', () => {
    const s = cardSummary(card, [spend(100, 'card', 'food'), spend(250, 'card', 'food'), spend(70, 'card', 'fuel'), spend(900, 'bank', 'food')], []);
    expect(s?.byCategoryPaise).toEqual({ food: 350, fuel: 70 });
  });

  it('a bill payment reduces what is still to pay', () => {
    const s = cardSummary(card, [spend(1_000_000, 'card'), transfer(400_000, 'bank', 'card')], []);
    expect(s).toEqual({ spentPaise: 1_000_000, otherPaise: 0, paidPaise: 400_000, duePaise: 600_000, byCategoryPaise: {} });
  });

  it('paying more than this month spent never goes below zero', () => {
    expect(cardSummary(card, [spend(100_000, 'card'), transfer(900_000, 'bank', 'card')], [])?.duePaise).toBe(0);
  });

  it('money moved out of a card is owed, a card-to-card transfer is not', () => {
    expect(cardSummary(card, [transfer(200_000, 'card', 'bank'), transfer(50_000, 'card', null, true)], [])).toMatchObject({ spentPaise: 0, otherPaise: 250_000, duePaise: 250_000 });
    expect(cardSummary(new Set(['card', 'card2']), [transfer(200_000, 'card', 'card2')], [])?.duePaise).toBe(0);
  });
});
