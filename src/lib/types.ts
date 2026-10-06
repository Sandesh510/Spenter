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
  /** False until the user decides this month's starting balance (an amount, or none). */
  decided: boolean;
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
  credit_category: 'salary' | 'gone_back' | 'others' | null;
  reference: string | null;
  lent_loan_id: string | null;
}

export interface Loan {
  id: string;
  person_name: string;
  amount_paise: number;
  lent_on: string;
  note: string | null;
  settled_at: string | null;
  created_at: string;
  /** Sum of Got back credits linked to this loan. */
  returned_paise: number;
  /** Amount still owed: the loan less what has come back, or 0 once settled. */
  outstanding_paise: number;
}

export interface LoanView {
  isNew: boolean;
  outstandingPaise: number;
  rateBps: number;
  tenureRemaining: number;
  nextEmiDate: string;
  nextInterestPaise: number;
  nextPrincipalPaise: number;
  remainingAfterNextPaise: number;
}

export interface CommitmentItem {
  id: string;
  kind: 'subscription' | 'investment' | 'loan';
  name: string;
  amountPaise: number;
  dayOfMonth: number;
  categoryId: string;
  categoryName: string | null;
  bucket: Bucket | null;
  accountId: string;
  active: boolean;
  startsOn: string;
  postedThisMonth: boolean;
  nextDueDate: string;
  loan: LoanView | null;
}

export interface CommitmentsData {
  month: string;
  items: CommitmentItem[];
  totals: { subscriptionsPaise: number; investmentsPaise: number; emisPaise: number };
}

export interface Profile {
  theme: 'dark' | 'light';
  lockEnabled: boolean;
}
