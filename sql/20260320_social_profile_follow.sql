alter table public.user_profiles
  add column if not exists is_private_profile boolean not null default false;

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint follows_pk primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_id_idx on public.follows(following_id);

alter table public.follows enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
      and policyname = 'follows_select_authenticated'
  ) then
    create policy follows_select_authenticated
      on public.follows
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
      and policyname = 'follows_insert_own'
  ) then
    create policy follows_insert_own
      on public.follows
      for insert
      to authenticated
      with check (auth.uid() = follower_id and follower_id <> following_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'follows'
      and policyname = 'follows_delete_own'
  ) then
    create policy follows_delete_own
      on public.follows
      for delete
      to authenticated
      using (auth.uid() = follower_id);
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
  follower_record record;
  insert_columns text;
  insert_values text;
  notification_title text;
  notification_body text;
begin
  notification_title := '팔로우한 유저가 새 글을 작성했습니다.';
  notification_body := coalesce(new.title, '새 게시글이 등록되었습니다.');

  for follower_record in
    select f.follower_id
    from public.follows f
    where f.following_id = new.author_id
  loop
    insert_columns := 'user_id, type, title, actor_id';
    insert_values := format(
      '%L, %L, %L, %L',
      follower_record.follower_id,
      'post_liked',
      notification_title,
      new.author_id
    );

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'notifications'
        and column_name = 'post_id'
    ) then
      insert_columns := insert_columns || ', post_id';
      insert_values := insert_values || format(', %L', new.id);
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'notifications'
        and column_name = 'body'
    ) then
      insert_columns := insert_columns || ', body';
      insert_values := insert_values || format(', %L', notification_body);
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'notifications'
        and column_name = 'message'
    ) then
      insert_columns := insert_columns || ', message';
      insert_values := insert_values || format(', %L', notification_body);
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'notifications'
        and column_name = 'ref_type'
    ) then
      insert_columns := insert_columns || ', ref_type';
      insert_values := insert_values || format(', %L', 'post');
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'notifications'
        and column_name = 'ref_id'
    ) then
      insert_columns := insert_columns || ', ref_id';
      insert_values := insert_values || format(', %L', new.id);
    end if;

    execute format(
      'insert into public.notifications (%s) values (%s)',
      insert_columns,
      insert_values
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists notify_followers_new_post on public.posts;

create trigger notify_followers_new_post
after insert on public.posts
for each row
execute function public.notify_followers_new_post();
