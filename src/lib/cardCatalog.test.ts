import { describe, expect, it } from 'vitest';
import { CARD_CATALOG, findCatalogCard, offersForCard } from './cardCatalog';

const categories = [
  { id: 'food', name: 'Food Wants' },
  { id: 'fuel', name: 'Fuel' },
  { id: 'rent', name: 'Rent' },
  { id: 'bills', name: 'Bills' },
  { id: 'groc', name: 'Groceries' },
];

describe('card catalogue', () => {
  it('lists the eight cards, each with at least one offer and a source', () => {
    expect(CARD_CATALOG).toHaveLength(8);
    for (const c of CARD_CATALOG) {
      expect(c.offers.length).toBeGreaterThan(0);
      expect(c.source).toMatch(/^https:\/\//);
    }
  });

  it('recognises a card from an account nickname', () => {
    expect(findCatalogCard('ICICI Amazon Pay')?.id).toBe('icici-amazon-pay');
    expect(findCatalogCard('HDFC Millennia')?.id).toBe('hdfc-millennia');
    expect(findCatalogCard('Axis Flipkart Pay CC')?.id).toBe('axis-flipkart');
    expect(findCatalogCard('BPCL SBI Credit Card')?.id).toBe('bpcl-sbi');
    expect(findCatalogCard('Cashback SBI Credit Card')?.id).toBe('sbi-cashback');
  });

  it('does not guess for a nickname that fits several, or none', () => {
    expect(findCatalogCard('My card')).toBeNull();
    expect(findCatalogCard('HDFC')).toBeNull();
  });
});

describe('offersForCard', () => {
  it('makes one offer per merchant, and ties exclusions to the user own categories', () => {
    const card = CARD_CATALOG.find(c => c.id === 'icici-amazon-pay')!;
    const { offers } = offersForCard(card, 'acc', categories);
    const amazon = offers.find(o => o.merchant === 'Amazon');
    expect(amazon).toMatchObject({ account_id: 'acc', kind: 'cashback_pct', rate: 5 });
    expect(offers.filter(o => ['Swiggy', 'BigBasket', 'BookMyShow'].includes(o.merchant ?? ''))).toHaveLength(3);
    const general = offers.find(o => o.title === '1% on everything else')!;
    expect(general.exclude_category_ids.sort()).toEqual(['fuel', 'rent']);
    // The bill payment offer attaches to the user's Bills category.
    expect(offers.find(o => o.category_id === 'bills')?.title).toBe('2% on bill payments');
  });

  it('converts caps and point values to paise', () => {
    const card = CARD_CATALOG.find(c => c.id === 'bpcl-sbi')!;
    const { offers } = offersForCard(card, 'acc', categories);
    const pump = offers.find(o => o.merchant === 'BPCL')!;
    expect(pump).toMatchObject({ kind: 'points_per_100', rate: 13, point_value_paise: 25, cap_paise: 32_500, cap_period: 'cycle' });
    expect(offers.find(o => o.category_id === 'groc')).toMatchObject({ rate: 5, cap_paise: 125_000, cap_period: 'month' });
  });

  it('reports an offer that needs a category the user does not have', () => {
    const card = CARD_CATALOG.find(c => c.id === 'icici-amazon-pay')!;
    const { offers, skipped } = offersForCard(card, 'acc', [{ id: 'food', name: 'Food Wants' }]);
    expect(offers.some(o => o.title === '2% on bill payments')).toBe(false);
    expect(skipped[0]).toContain('2% on bill payments');
  });
});
