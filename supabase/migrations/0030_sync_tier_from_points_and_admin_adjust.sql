create or replace function public.compute_point_tier(
  p_points integer,
  p_verified_school_email text,
  p_verified_university_id bigint
)
returns public.point_tier
language plpgsql
immutable
set search_path = public
as $$
begin
  if coalesce(p_points, 0) >= 3000 then
    return 'diamond'::public.point_tier;
  end if;

  if coalesce(p_points, 0) >= 1500 then
    return 'emerald'::public.point_tier;
  end if;

  if coalesce(p_points, 0) >= 500 then
    return 'gold'::public.point_tier;
  end if;

  if p_verified_school_email is not null and p_verified_university_id is not null then
    return 'silver'::public.point_tier;
  end if;

  return 'bronze'::public.point_tier;
end;
$$;

create or replace function public.sync_user_profile_tier_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_point_tier public.point_tier;
  v_role_text text := lower(coalesce(new.role::text, ''));
begin
  if v_role_text = 'master' then
    new.role := 'grandmaster'::public.user_role;
    new.point_tier := null;
    return new;
  end if;

  if v_role_text in ('grandmaster', 'campus_master', 'church_master') then
    new.point_tier := null;
    return new;
  end if;

  v_point_tier := public.compute_point_tier(
    new.points,
    new.verified_school_email,
    new.verified_university_id
  );

  new.point_tier := v_point_tier;
  new.role := (v_point_tier::text)::public.user_role;

  return new;
end;
$$;

drop trigger if exists trg_sync_user_profile_tier_fields on public.user_profiles;
create trigger trg_sync_user_profile_tier_fields
before insert or update of points, verified_school_email, verified_university_id, role, point_tier
on public.user_profiles
for each row
execute function public.sync_user_profile_tier_fields();

create or replace function public.admin_adjust_user_points(
  p_user_id uuid,
  p_delta integer,
  p_note text default null
)
returns table (
  points integer,
  point_tier public.point_tier,
  role public.user_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_points integer;
  v_reason_udt text;
  v_status_udt text;
  v_reason_value text;
  v_status_value text;
begin
  if p_user_id is null then
    raise exception 'user_id is required';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'delta must be a non-zero integer';
  end if;

  select greatest(coalesce(up.points, 0) + p_delta, 0)
    into v_new_points
    from public.user_profiles up
   where up.id = p_user_id
   for update;

  if not found then
    raise exception 'User not found';
  end if;

  update public.user_profiles up
     set points = v_new_points
   where up.id = p_user_id
  returning up.points, up.point_tier, up.role
       into points, point_tier, role;

  if to_regclass('public.point_ledger') is not null then
    select c.udt_name
      into v_reason_udt
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'point_ledger'
       and c.column_name = 'reason_code';

    select c.udt_name
      into v_status_udt
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'point_ledger'
       and c.column_name = 'status';

    if v_reason_udt is not null and v_status_udt is not null then
      select e.enumlabel
        into v_reason_value
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        join pg_enum e on e.enumtypid = t.oid
       where n.nspname = 'public'
         and t.typname = v_reason_udt
         and e.enumlabel = 'manual_adjustment'
       limit 1;

      if v_reason_value is null then
        select e.enumlabel
          into v_reason_value
          from pg_type t
          join pg_namespace n on n.oid = t.typnamespace
          join pg_enum e on e.enumtypid = t.oid
         where n.nspname = 'public'
           and t.typname = v_reason_udt
         order by e.enumsortorder
         limit 1;
      end if;

      select e.enumlabel
        into v_status_value
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        join pg_enum e on e.enumtypid = t.oid
       where n.nspname = 'public'
         and t.typname = v_status_udt
         and e.enumlabel = 'processed'
       limit 1;

      if v_status_value is null then
        select e.enumlabel
          into v_status_value
          from pg_type t
          join pg_namespace n on n.oid = t.typnamespace
          join pg_enum e on e.enumtypid = t.oid
         where n.nspname = 'public'
           and t.typname = v_status_udt
         order by e.enumsortorder
         limit 1;
      end if;

      if v_reason_value is not null and v_status_value is not null then
        execute format(
          'insert into public.point_ledger (user_id, reason_code, points_delta, status, ref_post_id, ref_comment_id, available_at, processed_at, created_at) values ($1, $2::public.%I, $3, $4::public.%I, null, null, now(), now(), now())',
          v_reason_udt,
          v_status_udt
        )
        using p_user_id, v_reason_value, p_delta, v_status_value;
      end if;
    end if;
  end if;

  return next;
end;
$$;

revoke all on function public.admin_adjust_user_points(uuid, integer, text) from public;
revoke all on function public.admin_adjust_user_points(uuid, integer, text) from anon;
revoke all on function public.admin_adjust_user_points(uuid, integer, text) from authenticated;
grant execute on function public.admin_adjust_user_points(uuid, integer, text) to service_role;

update public.user_profiles
   set role = role;
