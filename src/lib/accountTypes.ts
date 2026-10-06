/** The kinds of account a user can add. Stored in spend_accounts.kind, shared by client and server. */
export const ACCOUNT_KINDS = ['bank', 'savings', 'credit_card', 'wallet'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  bank: 'Bank',
  savings: 'Savings',
  credit_card: 'Credit card',
  wallet: 'Wallet',
};

export function isAccountKind(v: unknown): v is AccountKind {
  return typeof v === 'string' && (ACCOUNT_KINDS as readonly string[]).includes(v);
}
