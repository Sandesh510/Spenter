-- SpendCheck schema. All objects are prefixed `spend_` because this Supabase project
-- is shared with other apps. Every table is per-user and locked by RLS.
-- Money is stored as bigint paise. Totals are never stored; they are derived from transactions.
--
-- Default categories are NOT seeded here. They are created lazily by the app on a user's
-- first sign-in (netlify/functions/_lib/seed.ts), so other apps' signups are unaffected.

create extension if not exists pgcrypto;

-- Helper for month columns: must be defined before the tables that check it.
create or replace function public.spend_day_is_first(d date) returns boolean
language sql immutable as $$ select extract(day from d) = 1 $$;

-- SpendCheck's own per-user settings. Login identity lives in auth.users (shared Supabase Auth).
create table if not exists public.spend_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  theme        text not null default 'dark' check (theme in ('dark', 'light')),
  lock_salt    text,          -- salt for the 4-digit lock hash (computed client-side)
  lock_hash    text,          -- SHA-256(salt || pin); NULL = lock disabled
  seeded_at    timestamptz,   -- set once default categories exist for this user
  created_at   timestamptz not null default now()
);

create table if not exists public.spend_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nickname    text not null check (length(nickname) between 1 and 40),
  bank        text,
  kind        text,
  icon        text,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, nickname)
);

create table if not exists public.spend_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (length(name) between 1 and 40),
  bucket      text not null check (bucket in ('need', 'want', 'save')),
  color       text,
  icon        text,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- Opening balance per month (user enters it; it is not carried forward automatically).
create table if not exists public.spend_month_settings (
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month          date not null check (public.spend_day_is_first(month)),
  opening_paise  bigint not null default 0,
  primary key (user_id, month)
);

-- Planned spend per category per month.
create table if not exists public.spend_budgets (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id   uuid not null references public.spend_categories(id) on delete cascade,
  month         date not null check (public.spend_day_is_first(month)),
  planned_paise bigint not null check (planned_paise >= 0),
  primary key (user_id, category_id, month)
);

create table if not exists public.spend_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type              text not null check (type in ('spend', 'credit', 'transfer')),
  amount_paise      bigint not null check (amount_paise > 0 and amount_paise <= 1000000000),
  txn_date          date not null,
  description       text,
  category_id       uuid references public.spend_categories(id) on delete restrict,
  account_id        uuid references public.spend_accounts(id) on delete restrict,
  to_account_id     uuid references public.spend_accounts(id) on delete restrict,
  external          boolean not null default false,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- spend must be categorised; internal transfers need both accounts.
  constraint spend_txn_needs_category check (type <> 'spend' or category_id is not null),
  constraint spend_txn_transfer_accounts check (
    type <> 'transfer' or external or (account_id is not null and to_account_id is not null)
  )
);
create index if not exists spend_transactions_user_date
  on public.spend_transactions (user_id, txn_date) where deleted_at is null;

-- "Should I buy this?" decisions. Only 'bought' also creates a transaction (done in app).
create table if not exists public.spend_asks (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item          text not null,
  amount_paise  bigint not null check (amount_paise > 0),
  category_id   uuid references public.spend_categories(id) on delete set null,
  decision      text not null check (decision in ('bought', 'skipped', 'delayed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.spend_lent_loans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  person_name   text not null check (length(person_name) between 1 and 60),
  amount_paise  bigint not null check (amount_paise > 0),
  lent_on       date not null default current_date,
  note          text,
  settled_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists spend_lent_open
  on public.spend_lent_loans (user_id, person_name) where settled_at is null;

-- Row-level security: every table, every operation, owner only.
-- The Netlify Functions use the service-role key, which bypasses RLS; they enforce ownership
-- in code by filtering on the verified user id. These policies protect any future direct access.
do $$
declare t text;
begin
  foreach t in array array[
    'spend_profiles','spend_accounts','spend_categories','spend_month_settings',
    'spend_budgets','spend_transactions','spend_asks','spend_lent_loans'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
