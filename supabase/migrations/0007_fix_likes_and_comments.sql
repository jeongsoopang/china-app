create table if not exists public.post_likes (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create or replace function public.toggle_post_like(p_post_id bigint)
returns table(liked boolean, like_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_like_count integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if exists (
    select 1 from public.post_likes pl where pl.post_id = p_post_id and pl.user_id = v_user_id
  ) then
    delete from public.post_likes pl where pl.post_id = p_post_id and pl.user_id = v_user_id;
    update public.posts p
      set like_count = greatest(p.like_count - 1, 0)
      where p.id = p_post_id
      returning p.like_count into v_like_count;
    liked := false;
  else
    insert into public.post_likes (post_id, user_id) values (p_post_id, v_user_id);
    update public.posts p
      set like_count = p.like_count + 1
      where p.id = p_post_id
      returning p.like_count into v_like_count;
    liked := true;
  end if;

  like_count := coalesce(v_like_count, 0);
  return next;
end;
$$;

create or replace function public.create_comment(
  p_post_id bigint,
  p_body text,
  p_parent_comment_id bigint default null
)
returns table(comment_id bigint, message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_tier text := 'bronze';
  v_section_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select s.code
    into v_section_code
    from public.posts p
    join public.sections s on s.id = p.section_id
   where p.id = p_post_id;

  if v_section_code is null then
    raise exception 'Post not found';
  end if;

  if p_parent_comment_id is not null then
    perform 1
      from public.comments c
     where c.id = p_parent_comment_id
       and c.post_id = p_post_id;

    if not found then
      raise exception 'Parent comment not found';
    end if;
  end if;

  select up.tier::text
    into v_user_tier
    from public.user_profiles up
   where up.id = v_user_id;

  if v_section_code = 'qa' and p_parent_comment_id is null and v_user_tier = 'bronze' then
    raise exception 'Bronze users cannot answer Q&A questions';
  end if;

  insert into public.comments (post_id, author_id, body, parent_comment_id, created_at, updated_at)
  values (p_post_id, v_user_id, p_body, p_parent_comment_id, now(), now())
  returning id into comment_id;

  update public.posts p
     set comment_count = p.comment_count + 1,
         last_activity_at = now()
   where p.id = p_post_id;

  message := null;
  return next;
end;
$$;
