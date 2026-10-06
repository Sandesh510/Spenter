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

export interface MoneyIn {
  /** Everything that came in: income + got back + borrowed. */
  totalPaise: number;
  /** Earned money only: salary and others. */
  incomePaise: number;
  salaryPaise: number;
  goneBackPaise: number;
  borrowedPaise: number;
  othersPaise: number;
}

export interface MoneyOut {
  totalPaise: number;
  spendPaise: number;
  savingsPaise: number;
  outsidePaise: number;
  /** Money lent to people this month. */
  lentPaise: number;
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
  /** Balance left to spend less bills still to come this month (equal to the balance for past months). */
  /** Missing in Home data cached by versions before safe to spend. */
  safeToSpendPaise?: number;
  upcomingBills?: { name: string; amountPaise: number; dueOn: string }[];
  moneyIn: MoneyIn;
  moneyOut: MoneyOut;
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
  /** The account the money left from when it was lent. */
  debit_account_id: string | null;
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
  /** The account new entries start with. Missing in profiles cached by older versions. */
  defaultAccountId?: string | null;
}

export interface SavingsPlan {
  id: string;
  name: string;
  kind: 'goal' | 'emergency';
  target_paise: number;
  emergency_months: number | null;
  /** Saved before tracking started. */
  opening_paise: number;
  monthly_contribution_paise: number | null;
  target_date: string | null;
  account_id: string;
  category_id: string;
  priority: number;
  active: boolean;
  created_at: string;
  /** Derived: opening_paise + live contributions linked to this plan. */
  saved_paise: number;
}

export interface SavingsData {
  items: SavingsPlan[];
  /** Average monthly Needs + Wants spend over the last complete months with spend. */
  averageMonthlySpendPaise: number;
  /** Emergency fund target suggestion: that average × the emergency fund's months (6 when there is none). */
  emergencySuggestionPaise: number;
}

export interface InsurancePolicy {
  id: string;
  name: string;
  insurer: string | null;
  policy_number: string | null;
  policy_type: string;
  premium_paise: number;
  frequency: string;
  next_due_on: string;
  sum_assured_paise: number | null;
  account_id: string;
  category_id: string;
  auto_debit: boolean;
  active: boolean;
}
