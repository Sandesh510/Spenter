/**
 * CSV export of transactions (RFC 4180). Built in the browser from the export API's rows.
 * Amounts are positive rupees with 2 decimals; the Direction column says whether money came In, went Out,
 * or moved between your own accounts (Transfer).
 */

import { BUCKET_LABEL } from './categories';
import { paiseToPlain } from './money';
import type { Bucket } from './types';

/** A text cell, or a numeric cell that is written as is and never guarded. */
export type CsvCell = string | null | undefined | { numeric: string };

const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Marks a value as a number cell, e.g. an amount. Anything that isn't a plain number is still treated as text. */
export function numeric(value: string): CsvCell {
  return { numeric: value };
}

/**
 * Text that a spreadsheet would run as a formula (starts with = + - @, or a tab or carriage return)
 * gets a leading apostrophe, so it is shown as text instead.
 */
export function guardFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** One cell, quoted when it holds a comma, quote or line break; quotes inside are doubled. */
export function escapeCell(cell: CsvCell): string {
  let text: string;
  if (cell === null || cell === undefined) text = '';
  else if (typeof cell === 'object') text = NUMERIC.test(cell.numeric) ? cell.numeric : guardFormula(cell.numeric);
  else text = guardFormula(cell);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Rows to CSV text with CRLF line endings, as RFC 4180 asks. */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map(r => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

/** One transaction as the export API returns it. */
export interface ExportRow {
  date: string;
  type: 'spend' | 'credit' | 'transfer';
  amountPaise: number;
  external: boolean;
  categoryName: string | null;
  bucket: Bucket | null;
  accountName: string | null;
  toAccountName: string | null;
  description: string | null;
  reference: string | null;
  creditCategory: 'salary' | 'gone_back' | 'others' | 'borrowed' | null;
}

export const EXPORT_COLUMNS = [
  'Date',
  'Type',
  'Amount (₹)',
  'Direction',
  'Category',
  'Budget',
  'Account',
  'To account',
  'Description',
  'Reference',
  'Money-in type',
] as const;

const TYPE_LABEL: Record<ExportRow['type'], string> = { spend: 'Spend', credit: 'Money in', transfer: 'Transfer' };
const CREDIT_LABEL: Record<NonNullable<ExportRow['creditCategory']>, string> = {
  salary: 'Salary',
  gone_back: 'Got back',
  others: 'Others',
  borrowed: 'Borrowed',
};

/** In for money in, Out for spend and transfers to outside, Transfer between your own accounts. */
export function direction(r: Pick<ExportRow, 'type' | 'external'>): 'In' | 'Out' | 'Transfer' {
  if (r.type === 'credit') return 'In';
  if (r.type === 'transfer' && !r.external) return 'Transfer';
  return 'Out';
}

export function transactionsCsv(rows: ExportRow[]): string {
  return toCsv([
    [...EXPORT_COLUMNS],
    ...rows.map(r => [
      r.date,
      TYPE_LABEL[r.type],
      numeric(paiseToPlain(r.amountPaise)),
      direction(r),
      r.categoryName,
      r.bucket ? BUCKET_LABEL[r.bucket] : null,
      r.accountName,
      r.type === 'transfer' ? (r.external ? 'Outside' : r.toAccountName) : null,
      r.description,
      r.reference,
      r.creditCategory ? CREDIT_LABEL[r.creditCategory] : null,
    ]),
  ]);
}

/** Download file name, e.g. spendcheck-2026-01-to-2026-10.csv */
export function exportFileName(from: string, to: string): string {
  return `spendcheck-${from}-to-${to}.csv`;
}
