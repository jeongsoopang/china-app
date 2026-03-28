alter table public.posts
add column if not exists view_count integer not null default 0 check (view_count >= 0);

create or replace function public.increment_post_view_count(p_post_id integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_view_count integer := 0;
begin
  update public.posts
  set view_count = coalesce(view_count, 0) + 1
  where id = p_post_id
  returning view_count into v_view_count;

  return coalesce(v_view_count, 0);
end;
$$;

grant execute on function public.increment_post_view_count(integer) to authenticated;
