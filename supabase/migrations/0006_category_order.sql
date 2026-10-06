-- Category order for the Settings list, Log and pickers. Existing categories keep their creation order.
alter table public.spend_categories
  add column if not exists sort_order int not null default 0;

update public.spend_categories c
set sort_order = s.rn
from (
  select id, row_number() over (partition by user_id order by created_at, id) - 1 as rn
  from public.spend_categories
) s
where c.id = s.id;

create index if not exists spend_categories_user_order
  on public.spend_categories (user_id, sort_order);
