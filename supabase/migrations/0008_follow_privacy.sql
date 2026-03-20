alter table public.user_profiles
  add column if not exists is_private boolean not null default false;

create table if not exists public.user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_pkey primary key (follower_id, following_id),
  constraint user_follows_not_self check (follower_id <> following_id)
);

create index if not exists idx_user_follows_following_id on public.user_follows(following_id);
create index if not exists idx_user_follows_follower_id on public.user_follows(follower_id);

alter table public.user_follows enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_follows'
      and policyname = 'user_follows_select_authenticated'
  ) then
    create policy user_follows_select_authenticated
      on public.user_follows
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_follows'
      and policyname = 'user_follows_insert_own'
  ) then
    create policy user_follows_insert_own
      on public.user_follows
      for insert
      to authenticated
      with check (auth.uid() = follower_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_follows'
      and policyname = 'user_follows_delete_own'
  ) then
    create policy user_follows_delete_own
      on public.user_follows
      for delete
      to authenticated
      using (auth.uid() = follower_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'user_profiles_select_public_or_followed'
  ) then
    create policy user_profiles_select_public_or_followed
      on public.user_profiles
      for select
      to authenticated
      using (
        auth.uid() = id
        or coalesce(is_private, false) = false
        or exists (
          select 1
          from public.user_follows f
          where f.following_id = user_profiles.id
            and f.follower_id = auth.uid()
        )
      );
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_enum
    where enumtypid = 'public.notification_type'::regtype
      and enumlabel = 'followed_user_posted'
  ) then
    alter type public.notification_type add value 'followed_user_posted';
  end if;
end
$$;

create or replace function public.notify_followers_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author_name text;
begin
  select up.display_name
    into v_author_name
    from public.user_profiles up
   where up.id = new.author_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    actor_id,
    post_id
  )
  select
    f.follower_id,
    'followed_user_posted',
    coalesce(v_author_name, '팔로우한 유저') || '님의 새 게시글',
    coalesce(v_author_name, '팔로우한 유저') || '님이 새 게시글을 작성했습니다.',
    new.author_id,
    new.id
  from public.user_follows f
  where f.following_id = new.author_id
    and f.follower_id <> new.author_id;

  return new;
end;
$$;

drop trigger if exists on_post_created_notify_followers on public.posts;
create trigger on_post_created_notify_followers
after insert on public.posts
for each row
execute function public.notify_followers_new_post();
