begin;

alter table public.posts
  add column if not exists degree text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_degree_check'
  ) then
    alter table public.posts
      add constraint posts_degree_check
      check (degree in ('bachelor', 'master', 'phd') or degree is null);
  end if;
end
$$;

create index if not exists posts_university_section_degree_created_idx
  on public.posts (university_id, section_id, degree, created_at desc);

with qa_section as (
  select id
  from public.sections
  where code = 'qa'
  limit 1
)
insert into public.categories (name, slug, section_id, is_active, sort_order)
select '시설', 'qa-facilities', qa_section.id, true, 10
from qa_section
where not exists (
  select 1 from public.categories where slug = 'qa-facilities'
);

with qa_section as (
  select id
  from public.sections
  where code = 'qa'
  limit 1
)
insert into public.categories (name, slug, section_id, is_active, sort_order)
select '기숙사', 'qa-dorm', qa_section.id, true, 20
from qa_section
where not exists (
  select 1 from public.categories where slug = 'qa-dorm'
);

with qa_section as (
  select id
  from public.sections
  where code = 'qa'
  limit 1
)
insert into public.categories (name, slug, section_id, is_active, sort_order)
select '공부', 'qa-study', qa_section.id, true, 30
from qa_section
where not exists (
  select 1 from public.categories where slug = 'qa-study'
);

update public.categories
set is_active = false,
    updated_at = now()
where slug = 'qa-question';

commit;
