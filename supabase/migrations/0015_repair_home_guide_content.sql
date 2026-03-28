create table if not exists public.home_guide_content (
  id integer primary key default 1,
  title text not null default '',
  body text not null default '',
  image_url text,
  is_visible boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_guide_content_singleton check (id = 1)
);

insert into public.home_guide_content (id, title, body, image_url, is_visible)
values (
  1,
  'Welcome to LUCL',
  'Use search to find posts and useful information across LUCL.
Use quick actions to jump to your school, announcements, and your own page.
More guides and tips will be updated here.',
  null,
  true
)
on conflict (id) do nothing;

drop trigger if exists set_home_guide_content_updated_at on public.home_guide_content;
create trigger set_home_guide_content_updated_at
before update on public.home_guide_content
for each row
execute function public.set_updated_at();
