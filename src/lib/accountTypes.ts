/** The kinds of account a user can add. Stored in spend_accounts.kind, shared by client and server. */
export const ACCOUNT_KINDS = ['bank', 'savings', 'credit_card', 'wallet'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Bank',
  savings: 'Savings',
  credit_card: 'Credit card',
  wallet: 'Wallet',
};

/** Strict check for a value the user may save. Older free-text kinds are not accepted here. */
export function isAccountKind(v: unknown): v is AccountKind {
  return typeof v === 'string' && (ACCOUNT_KINDS as readonly string[]).includes(v);
}

/**
 * Reads any stored kind, including free text saved before kinds were fixed ('Credit card', 'Debit',
 * 'Cash', 'UPI wallet'), as one of the four kinds. Returns null when it can't tell.
 */
export function normaliseAccountKind(v: unknown): AccountKind | null {
  if (isAccountKind(v)) return v;
  if (typeof v !== 'string') return null;
  const t = v.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (t === '') return null;
  if (t.includes('credit')) return 'credit_card';
  if (t.includes('saving')) return 'savings';
  if (t.includes('wallet') || t === 'cash' || t === 'upi' || t.includes('prepaid')) return 'wallet';
  if (t.includes('bank') || t.includes('debit') || t.includes('current') || t.includes('salary')) return 'bank';
  return null;
}

/** True for a credit card, whether stored as 'credit_card' or older text such as 'Credit card'. */
export function isCreditCard(kind: unknown): boolean {
  return normaliseAccountKind(kind) === 'credit_card';
}
