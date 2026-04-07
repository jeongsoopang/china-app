-- Normalize existing duplicates deterministically before enforcing normalized uniqueness.
with ranked as (
  select
    id,
    display_name,
    row_number() over (
      partition by lower(btrim(display_name))
      order by created_at asc, id asc
    ) as rn
  from public.user_profiles
  where display_name is not null
    and btrim(display_name) <> ''
)
update public.user_profiles as up
set display_name = btrim(up.display_name) || '_' || (ranked.rn - 1)::text
from ranked
where up.id = ranked.id
  and ranked.rn > 1;

-- If collisions still exist (e.g. an existing row already had the computed suffix),
-- append a deterministic id suffix for later duplicates.
with ranked as (
  select
    id,
    display_name,
    row_number() over (
      partition by lower(btrim(display_name))
      order by created_at asc, id asc
    ) as rn
  from public.user_profiles
  where display_name is not null
    and btrim(display_name) <> ''
)
update public.user_profiles as up
set display_name = btrim(up.display_name) || '_' || substring(up.id from 1 for 8)
from ranked
where up.id = ranked.id
  and ranked.rn > 1;

-- Do not keep raw unique(display_name); enforce normalized uniqueness instead.
alter table public.user_profiles
  drop constraint if exists user_profiles_display_name_key;

create unique index if not exists user_profiles_display_name_ci_unique_idx
  on public.user_profiles (lower(btrim(display_name)))
  where display_name is not null
    and btrim(display_name) <> '';
