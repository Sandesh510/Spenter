-- The account every new entry starts with. Cleared if that account is deleted.
alter table public.spend_profiles
  add column if not exists default_account_id uuid references public.spend_accounts(id) on delete set null;
