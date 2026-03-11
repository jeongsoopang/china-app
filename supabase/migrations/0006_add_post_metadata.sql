alter table public.posts
  add column if not exists abstract text,
  add column if not exists thumbnail_image_url text,
  add column if not exists thumbnail_storage_path text;
