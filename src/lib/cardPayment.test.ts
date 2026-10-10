import { describe, expect, it } from 'vitest';
import { looksLikeCardPayment } from './cardPayment';

describe('looksLikeCardPayment', () => {
  it('catches names that mean paying a card bill', () => {
    for (const n of ['Credit card repayment', 'CC Bills', 'CC bill', 'Card payment', 'credit card bill payment', 'Pay card', 'HDFC card dues']) {
      expect(looksLikeCardPayment(n), n).toBe(true);
    }
  });

  it('leaves ordinary categories alone', () => {
    for (const n of ['Credit card annual fee', 'Electricity bill', 'Food Wants', 'Cardio gym', 'Rent', 'Paytm recharge', 'Discard']) {
      expect(looksLikeCardPayment(n), n).toBe(false);
    }
  });

  it('is false without a name', () => {
    expect(looksLikeCardPayment(null)).toBe(false);
    expect(looksLikeCardPayment('')).toBe(false);
  });
});
