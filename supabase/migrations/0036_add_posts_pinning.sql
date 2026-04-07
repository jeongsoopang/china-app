alter table if exists public.posts
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

create index if not exists idx_posts_university_campus_pinning_created_at
  on public.posts (university_id, campus_slug, is_pinned desc, pinned_at desc, created_at desc);
