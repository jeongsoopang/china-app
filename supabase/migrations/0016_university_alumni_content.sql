create table if not exists public.university_alumni_content (
  id bigserial primary key,
  university_id uuid not null references public.universities(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  is_visible boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint university_alumni_content_university_id_key unique (university_id)
);

drop trigger if exists set_university_alumni_content_updated_at on public.university_alumni_content;
create trigger set_university_alumni_content_updated_at
before update on public.university_alumni_content
for each row
execute function public.set_updated_at();
