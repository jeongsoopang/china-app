alter table if exists public.announcements
  add column if not exists is_pinned boolean not null default false,
  add column if not exists pinned_at timestamptz;

create index if not exists idx_announcements_published_pinning
  on public.announcements (is_published desc, is_pinned desc, pinned_at desc, published_at desc, created_at desc);

create or replace function public.publish_announcement(
  p_announcement_id bigint,
  p_actor_user_id uuid,
  p_is_pinned boolean default false
)
returns table (published boolean, message text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_user_id is null then
    return query
    select false, 'Actor user id is required.'::text;
    return;
  end if;

  update public.announcements
  set
    is_published = true,
    status = 'published',
    published_by = p_actor_user_id,
    published_at = coalesce(published_at, now()),
    is_pinned = p_is_pinned,
    pinned_at = case when p_is_pinned then now() else null end,
    updated_at = now()
  where id = p_announcement_id;

  if not found then
    return query
    select false, 'Announcement not found.'::text;
    return;
  end if;

  return query
  select true, null::text;
end;
$$;
