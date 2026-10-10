import { describe, expect, it } from 'vitest';
import { matchCard, parseOfferImport } from './offers';

const accounts = [
  { id: 'a1', nickname: 'ICICI Amazon Pay', kind: 'credit_card' },
  { id: 'a2', nickname: 'HDFC Millennia', kind: 'credit_card' },
  { id: 'a3', nickname: 'SBI Cashback', kind: 'credit_card' },
  { id: 'a4', nickname: 'Savings', kind: 'savings' },
];
const categories = [{ id: 'c1', name: 'Shopping' }, { id: 'c2', name: 'Food Wants' }];

describe('matchCard', () => {
  it('matches an exact nickname, ignoring case and spacing', () => {
    expect(matchCard('icici amazon pay', accounts)?.id).toBe('a1');
  });

  it('matches a name inside a nickname, or the other way round', () => {
    expect(matchCard('Millennia', accounts)?.id).toBe('a2');
    expect(matchCard('HDFC Millennia Credit Card', accounts)?.id).toBe('a2');
  });

  it('only matches credit cards', () => {
    expect(matchCard('Savings', accounts)).toBeNull();
  });

  it('refuses a name that matches nothing, or that is ambiguous', () => {
    expect(matchCard('Kotak', accounts)).toBeNull();
    expect(matchCard('Card', [{ id: 'x', nickname: 'Axis Card', kind: 'credit_card' }, { id: 'y', nickname: 'HDFC Card', kind: 'credit_card' }])).toBeNull();
  });
});

describe('parseOfferImport', () => {
  it('reads cashback, points and flat offers against cards and categories', () => {
    const text = JSON.stringify([
      { card: 'ICICI Amazon Pay', merchant: 'Amazon', type: 'cashback', rate: 5, cap: 2000, capPer: 'month', title: '5% on Amazon' },
      { card: 'Millennia', category: 'shopping', type: 'points', rate: 4, pointValue: 0.5, minSpend: '1,000', validTo: '2026-12-31' },
      { card: 'SBI Cashback', type: 'flat', rate: 100 },
    ]);
    const r = parseOfferImport(text, accounts, categories);
    expect(r.errors).toEqual([]);
    expect(r.offers[0]).toMatchObject({ account_id: 'a1', kind: 'cashback_pct', rate: 5, cap_paise: 200_000, cap_period: 'month', merchant: 'Amazon', category_id: null });
    expect(r.offers[1]).toMatchObject({ account_id: 'a2', kind: 'points_per_100', point_value_paise: 50, category_id: 'c1', min_spend_paise: 100_000, valid_to: '2026-12-31' });
    expect(r.offers[2]).toMatchObject({ account_id: 'a3', kind: 'flat', rate: 100, title: 'All spends' });
  });

  it('accepts an object with an offers list', () => {
    const r = parseOfferImport(JSON.stringify({ offers: [{ card: 'Millennia', type: 'cashback', rate: 1 }] }), accounts, categories);
    expect(r.offers).toHaveLength(1);
  });

  it('reports what cannot be read instead of guessing', () => {
    const r = parseOfferImport(
      JSON.stringify([
        { card: 'Kotak', type: 'cashback', rate: 5 },
        { card: 'Millennia', type: 'cashback', rate: 0 },
        { card: 'Millennia', type: 'points', rate: 4 },
        { card: 'Millennia', type: 'cashback', rate: 5, category: 'Nowhere' },
        { card: 'Millennia', type: 'bonus', rate: 5 },
      ]),
      accounts,
      categories,
    );
    expect(r.offers).toEqual([]);
    expect(r.errors).toHaveLength(5);
    expect(r.errors[0]).toContain('Offer 1');
  });

  it('says so when the text is not JSON', () => {
    expect(parseOfferImport('5% on Amazon', accounts, categories).errors[0]).toContain('not valid JSON');
  });
});
