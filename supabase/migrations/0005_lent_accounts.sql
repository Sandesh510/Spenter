-- A money-lent entry records the account the money left from (debit). A Got back credit goes to
-- the account it comes back into (credit). Existing loans have no debit account yet.
alter table public.spend_lent_loans
  add column if not exists debit_account_id uuid references public.spend_accounts(id) on delete set null;
