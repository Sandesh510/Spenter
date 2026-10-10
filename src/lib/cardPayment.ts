/**
 * Paying a credit card bill is a transfer to the card account, never a spend: the purchases were
 * already counted when they were made, so recording the payment as spend counts the money twice and
 * leaves the card's owed amount untouched.
 *
 * A category named like a card payment ("Credit card repayment", "CC bill", "Card payment") is a sign
 * someone is about to record it as a spend. A name needs both a card word and a payment word, so
 * "Credit card annual fee" or "Electricity bill" are left alone.
 */
const CARD_WORD = /\b(card|cards|cc)\b/i;
const PAYMENT_WORD = /\b(bill|bills|repay|repays|repayment|repayments|payment|payments|paid|pay|due|dues|settle|settlement|outstanding)\b/i;

export function looksLikeCardPayment(categoryName: string | null | undefined): boolean {
  if (!categoryName) return false;
  return CARD_WORD.test(categoryName) && PAYMENT_WORD.test(categoryName);
}

export const CARD_PAYMENT_MESSAGE =
  'This looks like a credit card bill payment. Record it as a transfer to the card (Pay card bill), not as a spend, so the card owed amount goes down and the money is not counted twice.';
