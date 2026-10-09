-- Credit card billing cycle: the day each month the statement is generated, and the day its payment is due.
-- Expected income: a rough monthly figure and the day it usually arrives, for the cash outlook.
-- Both are optional and only used for estimates; nothing is posted from them.
alter table public.spend_accounts
  add column if not exists statement_day smallint check (statement_day is null or statement_day between 1 and 31),
  add column if not exists due_day smallint check (due_day is null or due_day between 1 and 31);

alter table public.spend_profiles
  add column if not exists expected_income_paise bigint check (expected_income_paise is null or expected_income_paise > 0),
  add column if not exists income_day smallint check (income_day is null or income_day between 1 and 31);
