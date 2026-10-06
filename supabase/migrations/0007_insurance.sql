-- Insurance policies. A premium is either recorded by hand ("Mark paid") or posted automatically
-- on its due date when auto_debit is on. Each due date is recorded once: the unique key below
-- means a manual payment and an auto-debit can never both record the same premium.

create table if not exists public.spend_insurance_policies (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name              text not null check (length(name) between 1 and 60),
  insurer           text check (insurer is null or length(insurer) <= 60),
  policy_number     text check (policy_number is null or length(policy_number) <= 40),
  policy_type       text not null check (policy_type in ('health', 'life', 'vehicle', 'other')),
  premium_paise     bigint not null check (premium_paise > 0),
  frequency         text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  next_due_on       date not null,
  sum_assured_paise bigint check (sum_assured_paise is null or sum_assured_paise >= 0),
  account_id        uuid not null references public.spend_accounts(id) on delete restrict,
  category_id       uuid not null references public.spend_categories(id) on delete restrict,
  auto_debit        boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.spend_insurance_policies enable row level security;
drop policy if exists owner_all on public.spend_insurance_policies;
create policy owner_all on public.spend_insurance_policies for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.spend_transactions
  add column if not exists policy_id uuid references public.spend_insurance_policies(id) on delete set null,
  add column if not exists policy_due_on date;

create unique index if not exists spend_transactions_policy_once
  on public.spend_transactions (policy_id, policy_due_on);
