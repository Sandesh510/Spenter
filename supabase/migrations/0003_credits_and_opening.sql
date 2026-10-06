-- Credits get a category (Salary, Gone back, Others) and an optional reference.
-- A Gone back credit links to the lent loan it repays. The starting balance becomes optional:
-- NULL means the user chose "no starting balance" for that month.

alter table public.spend_month_settings alter column opening_paise drop not null;
alter table public.spend_month_settings alter column opening_paise drop default;

alter table public.spend_transactions
  add column if not exists credit_category text,
  add column if not exists reference text,
  add column if not exists lent_loan_id uuid references public.spend_lent_loans(id) on delete set null;

alter table public.spend_transactions drop constraint if exists spend_credit_category_check;
alter table public.spend_transactions add constraint spend_credit_category_check
  check (credit_category is null or credit_category in ('salary', 'gone_back', 'others'));

-- Existing credits have no category yet: they become 'others'. Their old optional category stays as-is.
update public.spend_transactions set credit_category = 'others' where type = 'credit' and credit_category is null;

alter table public.spend_transactions drop constraint if exists spend_credit_needs_category;
alter table public.spend_transactions add constraint spend_credit_needs_category
  check (type <> 'credit' or credit_category is not null);

alter table public.spend_transactions drop constraint if exists spend_gone_back_links_loan;
alter table public.spend_transactions add constraint spend_gone_back_links_loan
  check (credit_category = 'gone_back' or lent_loan_id is null);
