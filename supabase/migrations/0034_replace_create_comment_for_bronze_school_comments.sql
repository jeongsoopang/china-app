CREATE OR REPLACE FUNCTION public.create_comment(
  p_post_id bigint,
  p_body text,
  p_parent_comment_id bigint DEFAULT NULL::bigint
)
RETURNS TABLE(comment_id bigint, post_id bigint, is_answer boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid;
  v_role public.user_role;
  v_status public.user_status;
  v_post public.posts%rowtype;
  v_section_code public.section_code;
  v_body text;
  v_comment_id bigint;
  v_is_answer boolean := false;
  v_parent_post_id bigint;
  v_now timestamptz := now();
  v_today_shanghai_date date := timezone('Asia/Shanghai', now())::date;
  v_today_bronze_comment_count integer := 0;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_body := trim(coalesce(p_body, ''));
  if v_body = '' then
    raise exception 'Comment body is required';
  end if;

  select up.role, up.status
    into v_role, v_status
  from public.user_profiles up
  where up.id = v_user_id;

  if not found then
    raise exception 'User profile not found';
  end if;

  if v_status <> 'active' then
    raise exception 'User is not active';
  end if;

  select p.*
    into v_post
  from public.posts p
  where p.id = p_post_id
    and p.status = 'published';

  if not found then
    raise exception 'Post not found';
  end if;

  select s.code
    into v_section_code
  from public.sections s
  where s.id = v_post.section_id;

  if v_section_code is null then
    raise exception 'Post section not found';
  end if;

  if p_parent_comment_id is not null then
    select c.post_id
      into v_parent_post_id
    from public.comments c
    where c.id = p_parent_comment_id
      and c.status = 'published';

    if v_parent_post_id is null then
      raise exception 'Parent comment not found';
    end if;

    if v_parent_post_id <> p_post_id then
      raise exception 'Parent comment does not belong to this post';
    end if;
  end if;

  if v_section_code = 'qa'
     and v_post.is_question = true
     and p_parent_comment_id is null then
    v_is_answer := true;
  end if;

  if v_role = 'bronze' then
    if v_section_code = 'qa'
       and v_post.is_question = true
       and p_parent_comment_id is null then
      raise exception 'Bronze users cannot answer Q&A';
    end if;

    select count(*)
      into v_today_bronze_comment_count
    from public.comments c
    where c.author_id = v_user_id
      and c.status <> 'deleted'
      and timezone('Asia/Shanghai', c.created_at)::date = v_today_shanghai_date;

    if v_today_bronze_comment_count >= 5 then
      raise exception 'Bronze users can only create 5 comments per Shanghai day';
    end if;
  end if;

  insert into public.comments (
    post_id,
    author_id,
    parent_comment_id,
    body,
    status,
    created_at,
    updated_at
  )
  values (
    p_post_id,
    v_user_id,
    p_parent_comment_id,
    v_body,
    'published',
    v_now,
    v_now
  )
  returning id into v_comment_id;

  update public.posts p
  set comment_count = p.comment_count + 1,
      updated_at = v_now
  where p.id = p_post_id;

  if v_post.author_id <> v_user_id then
    perform public.insert_notification(
      v_post.author_id,
      'comment',
      case when v_is_answer then 'answer' else 'comment' end,
      v_comment_id,
      case when v_is_answer then '새 답변' else '새 댓글' end,
      case when v_is_answer then '내 질문에 새 답변이 달렸습니다.' else '내 게시글에 새 댓글이 달렸습니다.' end
    );
  end if;

  return query
  select
    v_comment_id as comment_id,
    p_post_id as post_id,
    v_is_answer as is_answer;
end;
$function$;
