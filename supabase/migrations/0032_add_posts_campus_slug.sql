alter table if exists public.posts
  add column if not exists campus_slug text;

create index if not exists idx_posts_university_campus_created_at
  on public.posts (university_id, campus_slug, created_at desc);
