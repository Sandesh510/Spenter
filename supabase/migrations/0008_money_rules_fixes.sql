-- Audit P0 fixes (docs/review/finance-audit-2026-10-07.md).

-- 1. Loans received are their own credit category, so they are never counted as income.
alter table public.spend_transactions drop constraint if exists spend_credit_category_check;
alter table public.spend_transactions add constraint spend_credit_category_check
  check (credit_category is null or credit_category in ('salary', 'gone_back', 'others', 'borrowed'));

update public.spend_transactions
set credit_category = 'borrowed'
where type = 'credit' and credit_category = 'others' and reference like 'Loan received:%';

-- 2. Commitments remember the last month they posted, so posting never stops after 24 months
--    and each Home load only looks at months after it.
alter table public.spend_commitments add column if not exists last_posted_month date;

update public.spend_commitments c
set last_posted_month = s.m
from (
  select commitment_id, max(commitment_month) as m
  from public.spend_transactions
  where commitment_id is not null
  group by commitment_id
) s
where c.id = s.commitment_id and c.last_posted_month is null;

-- 3. Every user gets an Insurance category, so premiums are not filed under another category.
insert into public.spend_categories (user_id, name, bucket, icon, sort_order)
select p.user_id, 'Insurance', 'need', 'shield',
       coalesce((select max(c.sort_order) + 1 from public.spend_categories c where c.user_id = p.user_id), 0)
from public.spend_profiles p
on conflict (user_id, name) do nothing;
