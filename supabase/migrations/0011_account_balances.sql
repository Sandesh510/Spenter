-- Balance per account. The user sets what an account held at the start of one day; the app derives
-- today's balance from that plus every entry dated on or after that day (src/lib/accountBalance.ts).
-- Nothing stores a running balance.
--
-- opening_balance_paise: the balance at the start of opening_balance_on, before that day's entries.
--   Integer paise. May be negative. For a credit card it is the amount owed, stored as a negative balance.
-- opening_balance_on: the day the opening balance applies from. Both are null when no balance is set.
alter table public.spend_accounts add column if not exists opening_balance_paise bigint;
alter table public.spend_accounts add column if not exists opening_balance_on date;

alter table public.spend_accounts drop constraint if exists spend_accounts_opening_balance_pair;
alter table public.spend_accounts add constraint spend_accounts_opening_balance_pair
  check ((opening_balance_paise is null) = (opening_balance_on is null));

-- Balances read every live entry for an account since its opening date. These cover both sides of a transfer.
create index if not exists spend_transactions_user_account_date
  on public.spend_transactions (user_id, account_id, txn_date) where deleted_at is null;
create index if not exists spend_transactions_user_to_account_date
  on public.spend_transactions (user_id, to_account_id, txn_date) where deleted_at is null and to_account_id is not null;

-- spend_accounts already has row-level security with the owner policy (0001_init.sql); new columns are covered.
