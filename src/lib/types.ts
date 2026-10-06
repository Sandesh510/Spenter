/** Shapes returned by the Netlify Functions. Money is always integer paise. */

export type Bucket = 'need' | 'want' | 'save';

export interface Category {
  id: string;
  name: string;
  bucket: Bucket;
  icon: string | null;
  plannedPaise: number | null;
  spentPaise: number;
}

export interface Account {
  id: string;
  nickname: string;
  bank: string | null;
  kind: string | null;
  icon: string | null;
  position: number;
}

export interface HomeBucket {
  bucket: Bucket;
  plannedPaise: number;
  spentPaise: number;
  hasBudget: boolean;
}

export interface AskItem {
  id: string;
  item: string;
  amountPaise: number;
  categoryName: string | null;
  decision: 'bought' | 'skipped' | 'delayed';
}

export interface RecentTxn {
  id: string;
  type: 'spend' | 'credit' | 'transfer';
  amountPaise: number;
  txnDate: string;
  description: string | null;
  categoryId: string | null;
}

export interface HomeData {
  month: string;
  openingPaise: number;
  hasOpening: boolean;
  incomePaise: number;
  spendPaise: number;
  savingsPaise: number;
  spendableBalancePaise: number;
  categories: Category[];
  buckets: HomeBucket[];
  recent: RecentTxn[];
  asks: AskItem[];
}

export interface TxnRow {
  id: string;
  type: 'spend' | 'credit' | 'transfer';
  amount_paise: number;
  txn_date: string;
  description: string | null;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  external: boolean;
}

export interface Loan {
  id: string;
  person_name: string;
  amount_paise: number;
  lent_on: string;
  note: string | null;
  settled_at: string | null;
  created_at: string;
}

export interface Profile {
  theme: 'dark' | 'light';
  lockEnabled: boolean;
}
