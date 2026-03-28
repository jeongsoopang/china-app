create table if not exists public.qa_best_answer_rewards (
  post_id integer primary key references public.posts(id) on delete cascade,
  comment_id integer not null references public.comments(id) on delete cascade,
  awarded_user_id uuid not null references auth.users(id) on delete cascade,
  points_awarded integer not null default 50 check (points_awarded = 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_qa_best_answer_rewards_updated_at on public.qa_best_answer_rewards;
create trigger set_qa_best_answer_rewards_updated_at
before update on public.qa_best_answer_rewards
for each row
execute function public.set_updated_at();

create index if not exists idx_qa_best_answer_rewards_awarded_user_id
  on public.qa_best_answer_rewards(awarded_user_id);

create or replace function public.accept_best_answer(
  p_post_id integer,
  p_comment_id integer
)
returns table (
  success boolean,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_post_author_id uuid;
  v_post_section_code public.section_code;
  v_comment_post_id integer;
  v_comment_author_id uuid;
  v_comment_parent_id integer;
  v_prev_reward_user_id uuid;
  v_new_author_role public.user_role;
begin
  if v_actor_id is null then
    return query select false, 'Authentication required.';
    return;
  end if;

  select p.author_id, s.code
    into v_post_author_id, v_post_section_code
    from public.posts p
    join public.sections s on s.id = p.section_id
   where p.id = p_post_id;

  if not found then
    return query select false, 'Post not found.';
    return;
  end if;

  if v_post_section_code <> 'qa' then
    return query select false, 'Best answer is only available for Q&A posts.';
    return;
  end if;

  if v_post_author_id <> v_actor_id then
    return query select false, 'Only the question author can accept a best answer.';
    return;
  end if;

  select c.post_id, c.author_id, c.parent_comment_id
    into v_comment_post_id, v_comment_author_id, v_comment_parent_id
    from public.comments c
   where c.id = p_comment_id;

  if not found then
    return query select false, 'Comment not found.';
    return;
  end if;

  if v_comment_post_id <> p_post_id then
    return query select false, 'Comment does not belong to this question.';
    return;
  end if;

  if v_comment_parent_id is not null then
    return query select false, 'Only top-level answers can be selected.';
    return;
  end if;

  update public.comments
     set is_best_answer = (id = p_comment_id)
   where post_id = p_post_id
     and parent_comment_id is null;

  update public.posts
     set accepted_answer_comment_id = p_comment_id
   where id = p_post_id;

  select r.awarded_user_id
    into v_prev_reward_user_id
    from public.qa_best_answer_rewards r
   where r.post_id = p_post_id;

  if v_prev_reward_user_id is not null then
    update public.user_profiles up
       set points = greatest(up.points - 50, 0),
           point_tier = case
             when greatest(up.points - 50, 0) >= 3000 then 'diamond'::public.point_tier
             when greatest(up.points - 50, 0) >= 1500 then 'emerald'::public.point_tier
             when greatest(up.points - 50, 0) >= 500 then 'gold'::public.point_tier
             when (
               coalesce(up.is_school_verified, false)
               or (
                 up.verified_school_email is not null
                 and lower(up.verified_school_email) like '%.edu.cn'
                 and up.verified_university_id is not null
               )
             ) then 'silver'::public.point_tier
             else 'bronze'::public.point_tier
           end,
           tier = (
             case
               when greatest(up.points - 50, 0) >= 3000 then 'diamond'::public.point_tier
               when greatest(up.points - 50, 0) >= 1500 then 'emerald'::public.point_tier
               when greatest(up.points - 50, 0) >= 500 then 'gold'::public.point_tier
               when (
                 coalesce(up.is_school_verified, false)
                 or (
                   up.verified_school_email is not null
                   and lower(up.verified_school_email) like '%.edu.cn'
                   and up.verified_university_id is not null
                 )
               ) then 'silver'::public.point_tier
               else 'bronze'::public.point_tier
             end
           )::public.user_tier
     where up.id = v_prev_reward_user_id
       and up.role not in ('campus_master', 'church_master', 'grandmaster');
  end if;

  delete from public.qa_best_answer_rewards
   where post_id = p_post_id;

  select up.role
    into v_new_author_role
    from public.user_profiles up
   where up.id = v_comment_author_id;

  if v_new_author_role in ('campus_master', 'church_master', 'grandmaster') then
    update public.user_profiles
       set points = 0,
           point_tier = null
     where id = v_comment_author_id;

    return query select true, 'Best answer updated. Special-role answers are excluded from points.';
    return;
  end if;

  update public.user_profiles up
     set points = up.points + 50,
         point_tier = case
           when (up.points + 50) >= 3000 then 'diamond'::public.point_tier
           when (up.points + 50) >= 1500 then 'emerald'::public.point_tier
           when (up.points + 50) >= 500 then 'gold'::public.point_tier
           when (
             coalesce(up.is_school_verified, false)
             or (
               up.verified_school_email is not null
               and lower(up.verified_school_email) like '%.edu.cn'
               and up.verified_university_id is not null
             )
           ) then 'silver'::public.point_tier
           else 'bronze'::public.point_tier
         end,
         tier = (
           case
             when (up.points + 50) >= 3000 then 'diamond'::public.point_tier
             when (up.points + 50) >= 1500 then 'emerald'::public.point_tier
             when (up.points + 50) >= 500 then 'gold'::public.point_tier
             when (
               coalesce(up.is_school_verified, false)
               or (
                 up.verified_school_email is not null
                 and lower(up.verified_school_email) like '%.edu.cn'
                 and up.verified_university_id is not null
               )
             ) then 'silver'::public.point_tier
             else 'bronze'::public.point_tier
           end
         )::public.user_tier
   where up.id = v_comment_author_id;

  insert into public.qa_best_answer_rewards (
    post_id,
    comment_id,
    awarded_user_id,
    points_awarded
  )
  values (
    p_post_id,
    p_comment_id,
    v_comment_author_id,
    50
  )
  on conflict (post_id) do update
    set comment_id = excluded.comment_id,
        awarded_user_id = excluded.awarded_user_id,
        points_awarded = excluded.points_awarded,
        updated_at = now();

  return query select true, 'Best answer updated.';
end;
$$;

grant execute on function public.accept_best_answer(integer, integer) to authenticated;
