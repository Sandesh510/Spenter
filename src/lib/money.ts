/** All money is stored as integer paise (1 rupee = 100 paise). */

const MAX_PAISE = 1_00_00_000 * 100; // ₹1 crore (10,000,000) per entry, in paise

/**
 * Parse a user-typed rupee amount ("1234", "1234.5", "1234.50") into paise.
 * Throws on invalid input rather than silently dropping digits.
 */
export function parseRupeesToPaise(input: string): number {
  const trimmed = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const [whole, frac = ''] = trimmed.split('.');
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (paise <= 0) throw new Error('Amount must be greater than zero');
  if (paise > MAX_PAISE) throw new Error('Amount exceeds ₹1 crore limit');
  return paise;
}

/**
 * Format paise with Indian digit grouping: 1234567 paise -> "₹12,345.67".
 * Whole rupees drop the decimals. Negatives use a true minus sign.
 */
export function formatINR(paise: number, opts: { alwaysDecimals?: boolean } = {}): string {
  const sign = paise < 0 ? '−' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const frac = abs % 100;
  const showDecimals = opts.alwaysDecimals || frac !== 0;

  const digits = String(rupees);
  let grouped: string;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    const last3 = digits.slice(-3);
    const rest = digits.slice(0, -3);
    grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  }

  const body = showDecimals ? `${grouped}.${String(frac).padStart(2, '0')}` : grouped;
  return `${sign}₹${body}`;
}
