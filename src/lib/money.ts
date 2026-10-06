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

const MAX_BALANCE_PAISE = 100_00_00_000 * 100; // ₹100 crore, in paise

/**
 * Parse a typed account balance into paise. Unlike an entry amount it may be zero or negative
 * ("-2500", "−2,500.50"), since a balance can be overdrawn and a card balance is what is owed.
 */
export function parseBalanceToPaise(input: string): number {
  const trimmed = input.trim().replace(/,/g, '');
  const negative = /^[-−]/.test(trimmed);
  const body = negative ? trimmed.slice(1).trim() : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(body)) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  const [whole, frac = ''] = body.split('.');
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (paise > MAX_BALANCE_PAISE) throw new Error('Balance exceeds ₹100 crore');
  return negative && paise !== 0 ? -paise : paise;
}

/** Paise as a plain rupee figure with 2 decimals and no symbol or grouping: -123450 → "-1234.50". */
export function paiseToPlain(paise: number): string {
  const abs = Math.abs(paise);
  return `${paise < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
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
