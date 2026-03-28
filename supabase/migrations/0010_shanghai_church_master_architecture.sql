do $$
begin
  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_role') then
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_role'
        and e.enumlabel = 'church_master'
    ) then
      alter type public.user_role add value 'church_master';
    end if;
  end if;

  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_tier') then
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_tier'
        and e.enumlabel = 'church_master'
    ) then
      alter type public.user_tier add value 'church_master';
    end if;
  end if;
end
$$;

create table if not exists public.church_page_content (
  id integer primary key default 1,
  title text not null default '',
  body text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint church_page_content_singleton check (id = 1)
);

insert into public.church_page_content (id, title, body)
values (1, 'LUCL Shanghai Church', '교회 소개 콘텐츠를 준비 중입니다.')
on conflict (id) do nothing;

drop trigger if exists set_church_page_content_updated_at on public.church_page_content;
create trigger set_church_page_content_updated_at
before update on public.church_page_content
for each row
execute function public.set_updated_at();

do $$
declare
  v_fun_section_id public.sections.id%type;
begin
  select s.id
    into v_fun_section_id
    from public.sections s
   where s.code::text = 'fun'
   order by s.id
   limit 1;

  if v_fun_section_id is null then
    return;
  end if;

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '카페', 'fun-food-cafe', 10, true
  where not exists (select 1 from public.categories where slug = 'fun-food-cafe');

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '중식', 'fun-food-chinese', 11, true
  where not exists (select 1 from public.categories where slug = 'fun-food-chinese');

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '양식', 'fun-food-western', 12, true
  where not exists (select 1 from public.categories where slug = 'fun-food-western');

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '한식', 'fun-food-korean', 13, true
  where not exists (select 1 from public.categories where slug = 'fun-food-korean');

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '일식', 'fun-food-japanese', 14, true
  where not exists (select 1 from public.categories where slug = 'fun-food-japanese');

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '플레이스', 'fun-place', 20, true
  where not exists (select 1 from public.categories where slug = 'fun-place');

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '교회 소개', 'fun-church-intro', 30, true
  where not exists (select 1 from public.categories where slug = 'fun-church-intro');

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '교회 공지', 'fun-church-notice', 31, true
  where not exists (select 1 from public.categories where slug = 'fun-church-notice');
end
$$;
