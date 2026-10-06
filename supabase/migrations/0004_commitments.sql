-- Commitments: recurring subscriptions, SIP investments and loan EMIs.
-- Each active commitment posts one debit per month on its day. The unique key on
-- (commitment, month) stops a month from posting twice, even if requests overlap.

create table if not exists public.spend_commitments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind               text not null check (kind in ('subscription', 'investment', 'loan')),
  name               text not null check (length(name) between 1 and 60),
  -- Monthly charge: subscription price, SIP amount, or EMI.
  amount_paise       bigint not null check (amount_paise > 0 and amount_paise <= 1000000000),
  -- At most 28 so every month has the day.
  day_of_month       int not null check (day_of_month between 1 and 28),
  category_id        uuid not null references public.spend_categories(id) on delete restrict,
  account_id         uuid not null references public.spend_accounts(id) on delete restrict,
  active             boolean not null default true,
  starts_on          date not null default current_date,
  -- Loans only.
  loan_is_new        boolean,
  outstanding_paise  bigint check (outstanding_paise >= 0),
  rate_bps           int check (rate_bps >= 0 and rate_bps <= 6000),  -- annual rate in basis points: 1050 = 10.50%
  tenure_remaining   int check (tenure_remaining >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint spend_loan_fields check (
    kind <> 'loan' or (loan_is_new is not null and outstanding_paise is not null
                       and rate_bps is not null and tenure_remaining is not null)
  )
);

alter table public.spend_transactions
  add column if not exists commitment_id uuid references public.spend_commitments(id) on delete set null,
  add column if not exists commitment_month date;

-- One posting per commitment per month. Nulls are distinct, so ordinary transactions are unaffected.
create unique index if not exists spend_transactions_commitment_once
  on public.spend_transactions (commitment_id, commitment_month);

alter table public.spend_commitments enable row level security;
drop policy if exists owner_all on public.spend_commitments;
create policy owner_all on public.spend_commitments for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
