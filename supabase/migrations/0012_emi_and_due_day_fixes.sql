-- Audit follow-ups.

-- 1. Each posted EMI remembers the principal it paid off, so deleting a wrong EMI can give exactly that
--    principal (and one instalment) back to the loan. Older postings leave it empty and are estimated.
alter table public.spend_transactions add column if not exists principal_paise bigint;

-- 2. An insurance policy remembers the day of the month it is due on. A premium due on the 31st moves to
--    the last day of shorter months, then back to the 31st, instead of staying on the 28th for good.
alter table public.spend_insurance_policies
  add column if not exists due_day int check (due_day is null or due_day between 1 and 31);

update public.spend_insurance_policies
set due_day = extract(day from next_due_on)::int
where due_day is null;
