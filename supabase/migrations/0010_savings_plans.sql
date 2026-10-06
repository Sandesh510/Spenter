-- Savings plans: goals and one emergency fund per user. What has been saved is never stored:
-- it is opening_paise (saved before tracking) plus the live spend transactions linked by plan_id.
-- A contribution is a spend in a Save-bucket category, so it leaves the balance and counts
-- toward the Savings budget like any other saving.

create table if not exists public.spend_savings_plans (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                        text not null check (length(name) between 1 and 60),
  kind                        text not null check (kind in ('goal', 'emergency')),
  -- For an emergency fund this is months × average monthly Needs + Wants spend, worked out when saved.
  target_paise                bigint not null check (target_paise > 0),
  -- Emergency funds only (the app suggests 6). No column default, so a goal is never given months.
  emergency_months            int check (
                                (kind = 'emergency' and emergency_months between 1 and 24)
                                or (kind = 'goal' and emergency_months is null)
                              ),
  opening_paise               bigint not null default 0 check (opening_paise >= 0),
  monthly_contribution_paise  bigint check (monthly_contribution_paise is null or monthly_contribution_paise >= 0),
  target_date                 date,
  account_id                  uuid not null references public.spend_accounts(id) on delete restrict,
  -- Must be a Save-bucket category. Checked by the savings function, which owns every write.
  category_id                 uuid not null references public.spend_categories(id) on delete restrict,
  priority                    int not null default 0,
  active                      boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

alter table public.spend_savings_plans enable row level security;
drop policy if exists owner_all on public.spend_savings_plans;
create policy owner_all on public.spend_savings_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists spend_savings_plans_user
  on public.spend_savings_plans (user_id, priority);

-- One emergency fund per user.
create unique index if not exists spend_savings_plans_one_emergency
  on public.spend_savings_plans (user_id) where kind = 'emergency';

-- Contributions link to their plan. Removing a plan keeps its contributions as ordinary savings.
alter table public.spend_transactions
  add column if not exists plan_id uuid references public.spend_savings_plans(id) on delete set null;

create index if not exists spend_transactions_plan
  on public.spend_transactions (plan_id) where plan_id is not null;
