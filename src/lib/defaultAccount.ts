/** The account a new entry starts with: the user's default if it still exists, else the first account. */
export function pickAccount<T extends { id: string }>(accounts: T[], defaultAccountId: string | null | undefined): string | null {
  if (defaultAccountId && accounts.some(a => a.id === defaultAccountId)) return defaultAccountId;
  return accounts[0]?.id ?? null;
}
