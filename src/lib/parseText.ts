import { parseRupeesToPaise } from './money';

/**
 * Reads pasted lines of "date, account, amount[, description]" into entries to review.
 * Runs in the browser only: nothing pasted is sent anywhere until the user saves an entry.
 *
 * - Date: 2026-10-03, 03-10-2026, 03/10/2026, 03/10/26, 3 Oct 2026, 03-Oct-2026 (day first).
 * - Account: a nickname, a bank, or a type (savings, credit card, wallet, bank).
 * - Amount: 1500, 1500.50, ₹1,500 or "1,50,000". Thousands commas are joined back up.
 *   A trailing "Cr" or a leading "+" marks money in; anything else is a spend.
 * - Description: optional, everything after the amount.
 */

export interface ParsedLine {
  /** 1-based line number in the pasted text. */
  line: number;
  raw: string;
  /** Set when the line could not be read; the entry can still be completed by hand. */
  error: string | null;
  date: string | null;
  accountHint: string;
  /** Rupees as typed, normalised, e.g. "1500.50". Empty when unreadable. */
  amount: string;
  kind: 'spend' | 'credit';
  description: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > last) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Day-first dates only, as written in India. Returns YYYY-MM-DD or null. */
export function parseDate(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1');
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validDate(y, +m[2], +m[1]);
  }
  m = t.match(/^(\d{1,2})[\s-]+([a-z]{3,9})[\s-]+(\d{2}|\d{4})$/);
  const month = m ? MONTHS[m[2].slice(0, 3)] : undefined;
  if (m && month !== undefined) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return validDate(y, month, +m[1]);
  }
  return null;
}

/** Splits one line on commas, keeping commas inside double quotes. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/** A thousands group split off by a comma: 2 digits (Indian lakhs) or 3, maybe with paise and Cr/Dr. */
const GROUP = /^\d{2,3}(\.\d{1,2})?(\s*(cr|dr)\.?)?$/i;

function cleanAmount(text: string): { amount: string; credit: boolean } {
  let t = text.trim().toLowerCase();
  let credit = false;
  if (t.startsWith('+')) {
    credit = true;
    t = t.slice(1);
  }
  if (/\bcr\.?$/.test(t)) {
    credit = true;
    t = t.replace(/\bcr\.?$/, '');
  }
  t = t.replace(/\bdr\.?$/, '').replace(/^(₹|rs\.?|inr)\s*/, '').replace(/,/g, '').replace(/\s+/g, '');
  return { amount: t, credit };
}

export function parseLines(text: string, today: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((rawLine, i) => {
    const raw = rawLine.trim();
    if (!raw) return;
    const cols = splitLine(raw);
    // A header row such as "date, account, amount" is skipped.
    if (out.length === 0 && /date/i.test(cols[0] ?? '') && !parseDate(cols[0] ?? '')) return;

    const base: ParsedLine = { line: i + 1, raw, error: null, date: null, accountHint: '', amount: '', kind: 'spend', description: '' };
    if (cols.length < 3) {
      out.push({ ...base, error: 'Expected date, account, amount' });
      return;
    }

    const date = parseDate(cols[0]);
    const accountHint = cols[1];

    // The amount may have been split by thousands commas: join numeric pieces back on.
    let amountText = cols[2];
    let next = 3;
    while (next < cols.length && GROUP.test(cols[next]) && /\d$/.test(amountText)) {
      amountText += cols[next];
      next += 1;
    }
    const description = cols.slice(next).join(', ').trim();
    const { amount, credit } = cleanAmount(amountText);

    let error: string | null = null;
    let amountOut = amount;
    try {
      parseRupeesToPaise(amount);
    } catch {
      error = 'Amount not readable';
      amountOut = '';
    }
    if (!date) error = error ?? 'Date not readable';
    else if (date > today) error = error ?? 'Date is in the future';

    out.push({
      ...base,
      error,
      date: date && date <= today ? date : null,
      accountHint,
      amount: amountOut,
      kind: credit ? 'credit' : 'spend',
      description,
    });
  });

  return out;
}

export interface AccountLike {
  id: string;
  nickname: string;
  bank: string | null;
  kind: string | null;
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Words people use for each account type, including the starter accounts' older type text. */
const KIND_WORDS: Record<string, string[]> = {
  savings: ['savings', 'saving', 'savingsaccount', 'sb'],
  credit_card: ['creditcard', 'credit', 'card', 'cc'],
  wallet: ['wallet', 'upiwallet', 'upi', 'cash', 'paytm'],
  bank: ['bank', 'debit', 'current', 'salary'],
};

function kindOf(a: AccountLike): string {
  const k = norm(a.kind);
  for (const [kind, words] of Object.entries(KIND_WORDS)) if (k === norm(kind) || words.includes(k)) return kind;
  return '';
}

/**
 * The account a line names: nickname first, then bank, then account type.
 * Returns null when nothing matches, so the user picks one while reviewing.
 */
export function matchAccount(hint: string, accounts: AccountLike[]): string | null {
  const h = norm(hint);
  if (!h) return null;
  const byName = accounts.find(a => norm(a.nickname) === h) ?? accounts.find(a => norm(a.bank) === h);
  if (byName) return byName.id;
  const kind = Object.entries(KIND_WORDS).find(([k, words]) => norm(k) === h || words.includes(h))?.[0];
  if (kind) return accounts.find(a => kindOf(a) === kind)?.id ?? null;
  return accounts.find(a => norm(a.nickname).includes(h) || h.includes(norm(a.nickname)))?.id ?? null;
}
