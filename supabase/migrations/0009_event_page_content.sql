create table if not exists public.event_page_banners (
  id bigserial primary key,
  title text not null default '',
  image_url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_page_sponsors (
  id bigserial primary key,
  name text not null,
  image_url text not null,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_page_banners_sort_order
  on public.event_page_banners (sort_order, id);
create index if not exists idx_event_page_banners_is_active
  on public.event_page_banners (is_active);

create index if not exists idx_event_page_sponsors_sort_order
  on public.event_page_sponsors (sort_order, id);
create index if not exists idx_event_page_sponsors_is_active
  on public.event_page_sponsors (is_active);

drop trigger if exists set_event_page_banners_updated_at on public.event_page_banners;
create trigger set_event_page_banners_updated_at
before update on public.event_page_banners
for each row
execute function public.set_updated_at();

drop trigger if exists set_event_page_sponsors_updated_at on public.event_page_sponsors;
create trigger set_event_page_sponsors_updated_at
before update on public.event_page_sponsors
for each row
execute function public.set_updated_at();
