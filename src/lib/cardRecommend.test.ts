import { describe, expect, it } from 'vitest';
import { recommendCards, type CardCandidate, type CardSpend } from './cardRecommend';
import type { CardOffer } from './offers';

const offer = (over: Partial<CardOffer>): CardOffer => ({
  id: 'o', account_id: 'amazon', title: 'Offer', category_id: null, merchant: null, kind: 'cashback_pct', rate: 1,
  point_value_paise: null, cap_paise: null, cap_period: null, min_spend_paise: null, exclude_category_ids: [],
  valid_from: null, valid_to: null, note: null, ...over,
});
const card = (id: string, over: Partial<CardCandidate> = {}): CardCandidate => ({
  id, nickname: id, limitPaise: 10_000_000, owedPaise: 1_000_000, newPurchaseDue: '2026-11-25', statementDay: 5, ...over,
});
const today = '2026-10-10';
const buy = (over = {}) => ({ amountPaise: 500_000, categoryId: 'shopping', item: 'Amazon headphones', today, ...over });

describe('recommendCards', () => {
  it('puts the card with the best offer first, and says why in one line', () => {
    const r = recommendCards({
      purchase: buy(),
      cards: [card('amazon'), card('hdfc')],
      offers: [
        offer({ account_id: 'amazon', title: '5% on Amazon', merchant: 'Amazon', rate: 5, cap_paise: 200_000, cap_period: 'month' }),
        offer({ id: 'o2', account_id: 'hdfc', title: 'All spends', rate: 1 }),
      ],
      spends: [],
    });
    expect(r.map(x => x.cardId)).toEqual(['amazon', 'hdfc']);
    expect(r[0]).toMatchObject({ benefitPaise: 25_000 });
    expect(r[0].reason).toContain('₹250 back on Amazon');
    expect(r[0].reason).toContain('46 days to pay');
  });

  it('holds the benefit to what is left of the cap', () => {
    const spends: CardSpend[] = [{ accountId: 'amazon', date: '2026-10-02', paise: 3_800_000, categoryId: 'shopping', description: 'Amazon laptop' }];
    const r = recommendCards({
      purchase: buy(),
      cards: [card('amazon')],
      offers: [offer({ merchant: 'Amazon', rate: 5, cap_paise: 200_000, cap_period: 'month' })],
      spends,
    });
    // 5% of 38,000 = 1,900 already earned out of a 2,000 cap: 100 left, not 250.
    expect(r[0].benefitPaise).toBe(10_000);
    expect(r[0].reason).toContain('₹100 of cap left');
  });

  it('counts a quarterly cap from the start of the calendar quarter', () => {
    const spends: CardSpend[] = [{ accountId: 'amazon', date: '2026-09-15', paise: 1_000_000, categoryId: 'shopping', description: 'Amazon' }];
    const r = recommendCards({ purchase: buy(), cards: [card('amazon')], offers: [offer({ merchant: 'Amazon', rate: 5, cap_paise: 100_000, cap_period: 'quarter' })], spends });
    expect(r[0].benefitPaise).toBe(25_000); // September is last quarter: nothing earned yet this quarter
  });

  it('skips offers that do not apply: wrong merchant, wrong category, excluded, below minimum, expired', () => {
    const base = { account_id: 'amazon' };
    const cases = [
      offer({ ...base, merchant: 'Flipkart' }),
      offer({ ...base, category_id: 'fuel' }),
      offer({ ...base, exclude_category_ids: ['shopping'] }),
      offer({ ...base, min_spend_paise: 1_000_000 }),
      offer({ ...base, valid_to: '2026-09-30' }),
    ];
    for (const o of cases) {
      const r = recommendCards({ purchase: buy(), cards: [card('amazon')], offers: [o], spends: [] });
      expect(r[0].benefitPaise).toBe(0);
      expect(r[0].reason).toContain('No offer');
    }
  });

  it('values points by what a point is worth, and flat offers in rupees', () => {
    const r = recommendCards({
      purchase: buy({ amountPaise: 1_000_000 }),
      cards: [card('amazon'), card('hdfc')],
      offers: [
        offer({ account_id: 'amazon', kind: 'points_per_100', rate: 4, point_value_paise: 50 }),
        offer({ id: 'o2', account_id: 'hdfc', kind: 'flat', rate: 75 }),
      ],
      spends: [],
    });
    // ₹10,000 at 4 points per ₹100 = 400 points x ₹0.50 = ₹200; the flat offer is ₹75.
    expect(r.find(x => x.cardId === 'amazon')?.benefitPaise).toBe(20_000);
    expect(r.find(x => x.cardId === 'hdfc')?.benefitPaise).toBe(7_500);
  });

  it('puts a card without enough credit last and says how much is left', () => {
    const r = recommendCards({
      purchase: buy({ amountPaise: 2_000_000 }),
      cards: [card('amazon', { limitPaise: 2_500_000, owedPaise: 1_000_000 }), card('hdfc')],
      offers: [offer({ account_id: 'amazon', rate: 5 })],
      spends: [],
    });
    expect(r.map(x => x.cardId)).toEqual(['hdfc', 'amazon']);
    expect(r[1].blocked).toBe('Only ₹15,000 credit left');
  });

  it('breaks a tie by days to pay, and prefers the more specific offer', () => {
    const r = recommendCards({
      purchase: buy(),
      cards: [card('a', { newPurchaseDue: '2026-10-25' }), card('b', { newPurchaseDue: '2026-11-25' })],
      offers: [],
      spends: [],
    });
    expect(r.map(x => x.cardId)).toEqual(['b', 'a']);
    const s = recommendCards({
      purchase: buy(),
      cards: [card('amazon')],
      offers: [offer({ id: 'general', rate: 5 }), offer({ id: 'specific', merchant: 'Amazon', rate: 5, title: 'Amazon 5%' })],
      spends: [],
    });
    expect(s[0].offer?.id).toBe('specific');
  });

  it('warns when a purchase would use a lot of the limit', () => {
    const r = recommendCards({ purchase: buy({ amountPaise: 3_000_000 }), cards: [card('amazon', { limitPaise: 5_000_000, owedPaise: 0 })], offers: [], spends: [] });
    expect(r[0].utilisationPct).toBe(60);
    expect(r[0].reason).toContain('uses 60% of limit');
  });
});
