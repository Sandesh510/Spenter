/**
 * The starting balance to suggest for a new month: last month's closing balance.
 * Only when last month had a starting balance of its own (otherwise its balance is just a net movement,
 * not money in an account) and the money left over is positive. The user can always type another amount
 * or choose none.
 */
export function suggestOpening(previous: { hadOpening: boolean; closingPaise: number }): number | null {
  return previous.hadOpening && previous.closingPaise > 0 ? previous.closingPaise : null;
}
