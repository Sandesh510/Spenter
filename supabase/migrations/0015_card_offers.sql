-- Card offers: what each credit card gives back on a kind of purchase, used to suggest which card to use.
-- An offer can be tied to a category, a merchant word (matched against the item named in
-- "Should I buy this?"), both, or neither (a card-wide rate). Amounts are paise, like everywhere else.
create table if not exists public.spend_card_offers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id       uuid not null references public.spend_accounts(id) on delete cascade,
  title            text not null check (length(title) between 1 and 80),
  category_id      uuid references public.spend_categories(id) on delete set null,
  merchant         text check (merchant is null or length(merchant) between 1 and 40),
  -- cashback_pct: rate is a percent. points_per_100: rate is points per ₹100 (worth point_value_paise each).
  -- flat: rate is rupees off.
  kind             text not null check (kind in ('cashback_pct', 'points_per_100', 'flat')),
  rate             numeric(10, 2) not null check (rate > 0),
  point_value_paise integer check (point_value_paise is null or point_value_paise > 0),
  cap_paise        bigint check (cap_paise is null or cap_paise > 0),
  cap_period       text check (cap_period is null or cap_period in ('month', 'cycle', 'quarter')),
  min_spend_paise  bigint check (min_spend_paise is null or min_spend_paise > 0),
  -- Categories the offer does not apply to (fuel, rent, EMI and the like).
  exclude_category_ids uuid[] not null default '{}',
  valid_from       date,
  valid_to         date,
  note             text check (note is null or length(note) <= 200),
  created_at       timestamptz not null default now()
);

create index if not exists spend_card_offers_user_account_idx on public.spend_card_offers (user_id, account_id);

alter table public.spend_card_offers enable row level security;

drop policy if exists spend_card_offers_owner on public.spend_card_offers;
create policy spend_card_offers_owner on public.spend_card_offers
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
