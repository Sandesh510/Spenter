-- Credit card limit (optional). Available credit = limit - what is owed (derived, never stored).
alter table public.spend_accounts
  add column if not exists credit_limit_paise bigint
  check (credit_limit_paise is null or credit_limit_paise > 0);
